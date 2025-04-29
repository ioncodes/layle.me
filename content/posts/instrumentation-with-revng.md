---
author: "Layle"
slug: "instrumentation-with-revng"
aliases: ["/instrumentation-with-revng"]
title: "Instrumenting Binaries using revng and LLVM"
summary: "One of the first things I ever wanted to implement was an import hooking library that placed the hooks by rewriting the calls statically instead of hooking the functions in-memory."
tags: ["lifting", "c++", "revng", "llvm"]
date: 2021-08-23T06:59:00Z
draft: false
---


One of the first things I ever wanted to implement was an import hooking library that placed the hooks by rewriting the calls statically instead of hooking the functions in-memory. To implement this I ended up using [revng](https://rev.ng/). We’ll be exploring the implementation of a similar example to show how you can instrument your own ELF binaries using revng and LLVM. You’ll need a working LLVM development environment and workspace. If you want to set it up using CMake check out [this guide](__GHOST_URL__/using-llvm-with-cmake/).

## What is revng?

I think the revng repository explains it very well:

> revng is a static binary translator. Given a input ELF binary for one of the supported architectures (currently i386, x86-64, MIPS, ARM, AArch64 and s390x) it will analyze it and emit an equivalent LLVM IR. To do so, revng employs the QEMU intermediate representation (a series of TCG instructions) and then translates them to LLVM IR.

## What are we gonna do?

To keep it simple, we’ll be developing a tool that finds a call to `dlsym`, injects another call to `printf` printing out the string pointer passed to `dlsym`. I had this idea during a CTF where the binary wouldn’t allow me to debug the process (debugging it would break a crucial race condition). The task was to figure out what the arguments were and what functions were being called. I ended up using the `LD_PRELOAD` trick but I figured why not solve it differently :)You’ll need a dummy binary. Compile the following source code to follow along:

```cpp
#include <iostream>
#include <dlfcn.h>

typedef uint32_t random_function_t(const char*);

const char* g_encrypted_fn = "qtur";
const char* g_encrypted_str = "udru";

// xor string with key 0x1
char* decrypt(const char* encrypted, size_t encrypted_size) {
    char* ptr = (char*)malloc(encrypted_size + 1);
    
    for (int i = 0; i < encrypted_size; ++i) {
        ptr[i] = encrypted[i] ^ 1;
    }
    ptr[encrypted_size] = '\0';
    
    return ptr;
}

int main() {
    puts("-- test dlsym --");

    auto fn_name = decrypt(g_encrypted_fn, 4);
    auto fn_ptr = (random_function_t*)dlsym((void*)-1, fn_name);

    auto str = decrypt(g_encrypted_str, 4);
    fn_ptr(str);

    return 0;
}
```

Compile it using `g++ dummy.cpp -ldl -O0 -o dummy`.

## Setting up revng

First things first, we need the dependencies, or the setup is gonna kneecap us later on:

```bash
sudo apt install python3-pip git git-lfs graphviz graphviz-dev

```

We’ll have to work with [orchestra](https://github.com/revng/orchestra), which is essentially a build system for various revng tools and dependencies. We’ll be using orchestra in all future posts, so make sure you use this installation method.

```bash
# install orchestra
pip3 install --user --force-reinstall https://github.com/revng/revng-orchestra/archive/master.zip
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc # or use ~/.zshrc, whichever you use
source ~/.bashrc
cd ~
git clone https://github.com/revng/orchestra

# update orchestra components
cd orchestra
orc update
orc components

# install orchestra dependencies
sudo ./.orchestra/ci/install-dependencies.sh

# configure revng cmake
orchestra clone revng
orc configure -b revng

# drop into orchestra shell to build revng
orc shell -c revng

# build revng
ninja

# make revng available as command
orc install -b revng

```

revng should now be built and available as a command (`revng`) as long as you’re in the orchestra shell. You can drop back into it by executing `orc shell -c revng` in orchestra’s root folder.

## Lifting weights binaries 2.0

revng actually executes a series of different binaries. The steps are:

1. Lift the program to LLVM
2. Link QEMU helpers to emulate some complex instructions such as floating points
3. Compile LLVM IR to object code
4. Link the object code. If you add functions from other libraries while processing the IR, make sure to add them to the command (we won’t be doing this)
5. Merge linked code with a dynamic binary to fix up various things, resulting in a functional executable

To get a list of (almost) all steps executed, you can run `revng --verbose translate ./dummy`. We can make two shell scripts out of the output. Note that `$1` would originally be `dummy.translated.ll`:

```bash
/home/layle/orchestra/root/bin/revng-lift \
  -g \
  ll \
  dummy \
  dummy.translated.ll

```

```bash
/home/layle/orchestra/root/bin/llvm-link \
  -S \
  $1 \
  ../../../../../../home/layle/orchestra/root/share/revng/support-x86_64-normal.ll \
  -o \
  $1.linked.ll

/home/layle/orchestra/root/bin/llc \
  -O0 \
  $1.linked.ll \
  -o \
  $1.linked.ll.o \
  -disable-machine-licm \
  -filetype=obj

/home/layle/orchestra/root/link-only/bin/c++ \
  ./$1.linked.ll.o \
  -lz \
  -lm \
  -lrt \
  -lpthread \
  -L \
  ./ \
  -o \
  ./dummy.translated \
  -fno-pie \
  -no-pie \
  -Wl,-z,max-page-size=4096 \
  -Wl,--section-start=.o_r_0x400000=0x400000 \
  -Wl,--section-start=.o_rx_0x401000=0x401000 \
  -Wl,--section-start=.o_r_0x402000=0x402000 \
  -Wl,--section-start=.o_rw_0x403d68=0x403d68 \
  -fuse-ld=bfd \
  -Wl,--section-start=.elfheaderhelper=0x3fffff \
  -Wl,-Ttext-segment=0x405000 \
  -Wl,--no-as-needed \
  -ldl \
  -lstdc++ \
  -lc \
  -Wl,--as-needed

# this step is actually not shown but it's needed
cp ./dummy.translated ./dummy.translated.tmp

/home/layle/orchestra/root/bin/revng \
  merge-dynamic \
  ./dummy.translated.tmp \
  ./dummy \
  ./dummy.translated

```

`lift.sh` will give us `dummy.translated.ll` which is our lifted LLVM IR. We’ll be operating on this file.

## Examining the LLVM IR

Let’s look at the code where `puts` is used:

```llvm
bb.main:                                          ; preds = %dispatcher.entry_epoch_0_address_space_0_type_Code_x86_64
  call void (%struct.PlainMetaAddress, i64, i32, i8*, ...) @newpc(%struct.PlainMetaAddress { i32 0, i16 0, i16 4, i64 4198977 }, i64 4, i32 1, i8* null)
  call void (%struct.PlainMetaAddress, i64, i32, i8*, ...) @newpc(%struct.PlainMetaAddress { i32 0, i16 0, i16 4, i64 4198981 }, i64 1, i32 0, i8* null)
  %225 = load i64, i64* @rbp
  %226 = load i64, i64* @rsp
  %227 = add i64 %226, -8
  %228 = inttoptr i64 %227 to i64*
  store i64 %225, i64* %228
  store i64 %227, i64* @rsp
  call void (%struct.PlainMetaAddress, i64, i32, i8*, ...) @newpc(%struct.PlainMetaAddress { i32 0, i16 0, i16 4, i64 4198982 }, i64 3, i32 0, i8* null)
  %229 = load i64, i64* @rsp
  store i64 %229, i64* @rbp
  call void (%struct.PlainMetaAddress, i64, i32, i8*, ...) @newpc(%struct.PlainMetaAddress { i32 0, i16 0, i16 4, i64 4198985 }, i64 4, i32 0, i8* null)
  %230 = load i64, i64* @rsp
  %231 = add i64 %230, -32
  store i64 %231, i64* @rsp
  store i64 32, i64* @cc_src
  store i64 %231, i64* @cc_dst
  store i32 17, i32* @cc_op
  call void (%struct.PlainMetaAddress, i64, i32, i8*, ...) @newpc(%struct.PlainMetaAddress { i32 0, i16 0, i16 4, i64 4198989 }, i64 7, i32 0, i8* null)
  store i64 4202511, i64* @rdi
  call void (%struct.PlainMetaAddress, i64, i32, i8*, ...) @newpc(%struct.PlainMetaAddress { i32 0, i16 0, i16 4, i64 4198996 }, i64 5, i32 0, i8* null)
  %232 = load i64, i64* @rsp
  %233 = add i64 %232, -8
  %234 = inttoptr i64 %233 to i64*
  store i64 4199001, i64* %234
  store i64 %233, i64* @rsp
  store i64 4198592, i64* @pc
  call void @function_call(i8* blockaddress(@root, %bb.0x4010c0), i8* blockaddress(@root, %bb.main.0x18), %struct.PlainMetaAddress { i32 0, i16 0, i16 4, i64 4199001 }, i64* null, i8* null)
  br label %bb.0x4010c0

```

revng has a concept of denoting the presence of an original function through a marker (`function_call`). If we look closer, we can also notice that there are symbols called as the x64 register names: `@rdi`, `@rsp`, etc. These are global variables which revng uses to emulate the original CPU state. In revng jargon we call these “CSV” (CPU State Variables).

```llvm
store i64 4202511, i64* @rdi

```

If we look even closer, we notice that `4202511` is being stored into `@rdi`. That decimal is the same as `0x40200f` in hexadecimal which is the address our `-- test dlsym --` is located in. As a first step, we need to look up `libc`’s `dlsym` function prototype: `void *dlsym(void *handle, const char *symbol);`. We now know that `symbol` is represented by the x64 register `rsi` as it’s the 2nd argument. We’ll need this to define the function using LLVM. We are now able to form an idea of what we can do:

1. Find all references to `function_call`
2. Walk all instructions upwards for each reference finding the store instruction pointing to `@rsi`
3. Inject a `printf` call that prints `@rsi` (second argument in calling convention) before it executes `function_call` but after executing the store to `@rsi`

This way, it will eventually print out the string passed into `dlsym`.

## Automation using LLVM and C++

With an idea in mind we can start implementing it. We’ll have to be able to parse and dump LLVM IR files:

```cpp
#include <iostream>
#include <fstream>
#include <utility>

#include <llvm/IR/Module.h>
#include <llvm/IR/PassManager.h>
#include <llvm/IR/Verifier.h>
#include <llvm/IR/LLVMContext.h>
#include <llvm/IR/Instructions.h>
#include <llvm/IR/IRBuilder.h>
#include <llvm/IRReader/IRReader.h>
#include <llvm/Support/SourceMgr.h>

using llvm::LLVMContext;
using llvm::SMDiagnostic;
using llvm::Module;
using llvm::IRBuilder;
using llvm::CallInst;
using llvm::StoreInst;
using llvm::BranchInst;
using llvm::Instruction;
using llvm::FunctionType;
using llvm::ConstantInt;
using llvm::Type;
using llvm::ArrayRef;

void parse(const char* path, std::unique_ptr<Module>& program, LLVMContext& ctx)
{
    SMDiagnostic error;
    
    program = llvm::parseIRFile(path, error, ctx);
    if (!program)
    {
        printf("Failed to parse IR file\n");
        error.print(path, llvm::errs());

        exit(-1);
    }
}

void dump(const char* path, std::unique_ptr<Module>& program)
{
    std::string ir;
    llvm::raw_string_ostream stream(ir);
    program->print(stream, nullptr);

    std::ofstream output(path);
    output << ir;
    output.close();
}

void process(const std::unique_ptr<Module>& program, IRBuilder<>& builder)
{
    // TODO: Process IR
}

int main(int argc, char* argv[])
{
    LLVMContext context;
    std::unique_ptr<Module> program = nullptr;
    parse(argv[1], program, context);

    printf("Loaded IR: %s\n", program->getModuleIdentifier().data());

    IRBuilder builder(context);
    process(program, builder);

    // 0 => generated IR is valid
    printf("Verification: %d\n", llvm::verifyModule(*program, &llvm::dbgs()));
    dump(argv[2], program);
 
    return 0;
}

```

It’s time to get to the fun part. The very first thing we are going to do is getting a reference to `function_call`. Once we have that, we are going to fetch all references (`function_call->users()` in LLVM).

```cpp
const auto function_call = program->getFunction("function_call");

for (const auto& user : function_call->users())
{
    // make sure the reference is actually a call instruction
    if (!llvm::isa<CallInst>(user))
        continue;

    auto call_instruction = llvm::cast<CallInst>(user);
}

```

We are now looping through all references dismissing all non-call instructions. Our next step is getting a reference to the variable `@rsi`. In the same basic block, there must be at least one store instruction that writes to `@rsi`. This may not always be the case for all references but it must be the case where `function_call` actually ends up calling `dlsym`. Our next task is to find that instruction for each call to `function_call`. For this, we implement another function that returns the most recent instruction that stores into `@rsi`.

```cpp
Instruction* find_store(Instruction* start, const char* target)
{
    auto previous_instruction = start->getPrevNode();

    while (previous_instruction != nullptr)
    {
        // we only want to check store instructions
        if (llvm::isa<StoreInst>(previous_instruction))
        {
            const auto store_instruction = llvm::cast<StoreInst>(previous_instruction);
            const auto target_operand = store_instruction->getOperand(1);
            const auto operand_name = target_operand->getName().data();

            // make sure the operand (register) to be written matches our target
            if (strcmp(operand_name, target) == 0)
                return previous_instruction;
        }

        previous_instruction = previous_instruction->getPrevNode();
    }

    return nullptr;
}
```

Now that we are able to find the store instructions, it’s time to create our `printf` declaration. We’ll be using the format `dlsym => %p\n` to print our findings at runtime.

```cpp
void create_printf(const std::unique_ptr<Module>& program, IRBuilder<>& builder)
{
    // uint64_t printf(char*, uint64_t);
    std::vector<Type*> args = { builder.getInt8Ty()->getPointerTo(), builder.getInt64Ty() };
    auto function_type = FunctionType::get(builder.getInt64Ty(), args, false);

    program->getOrInsertFunction("printf", function_type);
}
```

It’s finally time to inject calls to `printf` into our IR. To do this, we’re going to iterate through all `function_call` references, get the most recent `@rsi` store instruction and then emit the `printf` call immediately after the store instruction. To successfully emit our `printf` call we also have to generate our format string. To do this we have to keep in mind that `@rsi`  **points** to a global storage of type `i64`. This means that we have to load the literal value from the pointer first. To do this we can use `builder.CreateLoad(rsi)`.

```cpp
void process(const std::unique_ptr<Module>& program, IRBuilder<>& builder)
{
    const auto function_call = program->getFunction("function_call");
    const auto fmt_str = builder.CreateGlobalStringPtr("dlsym => %p\n", "dlsym_fmt", 0, program.get());
    const auto print = program->getFunction("printf");

    for (const auto& user : function_call->users())
    {
        // make sure the reference is actually a call instruction
        if (!llvm::isa<CallInst>(user))
            continue;

        const auto call_instruction = llvm::cast<CallInst>(user);
        const auto store_instruction = find_store(call_instruction, "rsi");
        if (store_instruction == nullptr)
            continue;

        const auto rsi = store_instruction->getOperand(1);

        // we want to emit instructions after the store instruction
        builder.SetInsertPoint(store_instruction->getNextNode());
        const auto loaded = builder.CreateLoad(rsi);
        builder.CreateCall(print, { fmt_str, loaded });
    }
}
```

Now that we have written an instrumentation utility that prints out the pointer address passed into `dlsym` through `rsi` (2nd argument), we can finally run it on the translated IR and then recompile it back to a functioning ELF executable. To do this, execute the following commands:

```bash
# in orchestra shell
bash lift.sh
dlsym_hook dummy.translated.ll dummy.translated.processed.ll
bash recompile.sh dummy.translated.processed.ll

```

Originally the binary would print the following text:

```
$ ./dummy
-- test dlsym --
test
```

Let’s see what the instrumented version outputs:

```
$ ./dummy.translated
dlsym => 0x1
dlsym => 0x4165d4c8
dlsym => 0x4165d4c8
dlsym => 0xffff
dlsym => 0x404021
-- test dlsym --
dlsym => 0x4
dlsym => 0x1d94dc0
dlsym => 0x4
test
```

This looks great! Note that not all of those are arguments passed into `dlsym`. We are intercepting **all**  `function_call`s. Fun fact: The `0x4` is actually the size passed into `decrypt`! Either way, we can confidently assume that `0x1d94dc0` points to the decrypted string which is the name of a libc function to be loaded at runtime. To verify this, let’s check out what `gdb` has to say about it. Execute `b printf` to set a breakpoint on `printf` and continue using the command `c` until you see something along the lines of:

```
gef➤  c
Continuing.
dlsym => 0x4a2dc0
```

Make sure that this string was printed **after**  `-- test dlsym --`. Also, note that the exact pointer may vary. You should be able to see the following string behind the pointer:

![](/images/revng/dbg.png)

At this point, we figured out how to instrument the LLVM IR to dump “decrypted” contents from memory without having to debug the binary at all.

Our code so far looks like this:

```cpp
#include <iostream>
#include <fstream>
#include <utility>

#include <llvm/IR/Module.h>
#include <llvm/IR/PassManager.h>
#include <llvm/IR/Verifier.h>
#include <llvm/IR/LLVMContext.h>
#include <llvm/IR/Instructions.h>
#include <llvm/IR/IRBuilder.h>
#include <llvm/IRReader/IRReader.h>
#include <llvm/Support/SourceMgr.h>

using llvm::LLVMContext;
using llvm::SMDiagnostic;
using llvm::Module;
using llvm::IRBuilder;
using llvm::CallInst;
using llvm::StoreInst;
using llvm::BranchInst;
using llvm::Instruction;
using llvm::FunctionType;
using llvm::ConstantInt;
using llvm::Type;
using llvm::ArrayRef;
using llvm::ConstantDataArray;

void parse(const char* path, std::unique_ptr<Module>& program, LLVMContext& ctx)
{
    SMDiagnostic error;
    
    program = llvm::parseIRFile(path, error, ctx);
    if (!program)
    {
        printf("Failed to parse IR file\n");
        error.print(path, llvm::errs());

        exit(-1);
    }
}

void dump(const char* path, std::unique_ptr<Module>& program)
{
    std::string ir;
    llvm::raw_string_ostream stream(ir);
    program->print(stream, nullptr);

    std::ofstream output(path);
    output << ir;
    output.close();
}

Instruction* find_store(Instruction* start, const char* target)
{
    auto previous_instruction = start->getPrevNode();

    while (previous_instruction != nullptr)
    {
        // we only want to check store instructions
        if (llvm::isa<StoreInst>(previous_instruction))
        {
            const auto store_instruction = llvm::cast<StoreInst>(previous_instruction);
            const auto target_operand = store_instruction->getOperand(1);
            const auto operand_name = target_operand->getName().data();

            // make sure the operand (register) to be written matches our target
            if (strcmp(operand_name, target) == 0)
                return previous_instruction;
        }

        previous_instruction = previous_instruction->getPrevNode();
    }

    return nullptr;
}

void process(const std::unique_ptr<Module>& program, IRBuilder<>& builder)
{
    const auto function_call = program->getFunction("function_call");
    const auto fmt_str = builder.CreateGlobalStringPtr("dlsym => %p\n", "dlsym_fmt", 0, program.get());
    const auto print = program->getFunction("printf");

    for (const auto& user : function_call->users())
    {
        // make sure the reference is actually a call instruction
        if (!llvm::isa<CallInst>(user))
            continue;

        const auto call_instruction = llvm::cast<CallInst>(user);
        const auto store_instruction = find_store(call_instruction, "rsi");
        if (store_instruction == nullptr)
            continue;

        const auto rsi = store_instruction->getOperand(1);

        // we want to emit instructions after the store instruction
        builder.SetInsertPoint(store_instruction->getNextNode());
        const auto loaded = builder.CreateLoad(rsi);
        builder.CreateCall(print, { fmt_str, loaded });
    }
}

void create_printf(const std::unique_ptr<Module>& program, IRBuilder<>& builder)
{
    std::vector<Type*> args = { builder.getInt8Ty()->getPointerTo(), builder.getInt64Ty() };
    auto function_type = FunctionType::get(builder.getInt64Ty(), args, false);

    program->getOrInsertFunction("printf", function_type);
}

int main(int argc, char* argv[])
{
    LLVMContext context;
    std::unique_ptr<Module> program = nullptr;
    parse(argv[1], program, context);

    printf("Loaded IR: %s\n", program->getModuleIdentifier().data());

    IRBuilder builder(context);

    create_printf(program, builder);
    process(program, builder);

    printf("Verification: %d\n", llvm::verifyModule(*program, &llvm::dbgs()));
    dump(argv[2], program);
 
    return 0;
}

```

## Going the extra mile

Let’s go the extra mile and instrument the binary so that we can output the string at runtime, not just the pointer!To do this, we have to implement a function that checks the provided pointer and makes sure it’s actually pointing to valid memory. Then, if the check passes, we can print the content of the pointer. To do this, we are going to introduce a new function called `print_checked` which we are going to implement in C.To get started let’s create a new function declaration for LLVM first:

```cpp
void create_print_checked(const std::unique_ptr<Module>& program, IRBuilder<>& builder)
{
    // void print_checked(char*);
    std::vector<Type*> args = { builder.getInt8Ty()->getPointerTo() };
    auto function_type = FunctionType::get(builder.getVoidTy(), args, false);

    program->getOrInsertFunction("print_checked", function_type);
}
```

The next step is to create a call to `print_checked`. As revng emulates x64 registers through global LLVM variables the storage type of `rsi` is `i64`. In order to pass LLVMs type checks for `print_checked` we have to cast our literal value stored in `@rsi` to a `i8*`. To do this we insert the following code into our `process` function:

```cpp
// emit a call to an external checked printf
const auto ptr_type = Type::getIntNPtrTy(program->getContext(), 8);
const auto ptr = builder.CreateCast(Instruction::CastOps::IntToPtr, loaded, ptr_type);
builder.CreateCall(print_checked, { ptr });
```

Our code should now look like this:

```cpp
#include <iostream>
#include <fstream>
#include <utility>

#include <llvm/IR/Module.h>
#include <llvm/IR/PassManager.h>
#include <llvm/IR/Verifier.h>
#include <llvm/IR/LLVMContext.h>
#include <llvm/IR/Instructions.h>
#include <llvm/IR/IRBuilder.h>
#include <llvm/IRReader/IRReader.h>
#include <llvm/Support/SourceMgr.h>

using llvm::LLVMContext;
using llvm::SMDiagnostic;
using llvm::Module;
using llvm::IRBuilder;
using llvm::CallInst;
using llvm::StoreInst;
using llvm::BranchInst;
using llvm::Instruction;
using llvm::FunctionType;
using llvm::ConstantInt;
using llvm::Type;
using llvm::ArrayRef;
using llvm::ConstantDataArray;

void parse(const char* path, std::unique_ptr<Module>& program, LLVMContext& ctx)
{
    SMDiagnostic error;
    
    program = llvm::parseIRFile(path, error, ctx);
    if (!program)
    {
        printf("Failed to parse IR file\n");
        error.print(path, llvm::errs());

        exit(-1);
    }
}

void dump(const char* path, std::unique_ptr<Module>& program)
{
    std::string ir;
    llvm::raw_string_ostream stream(ir);
    program->print(stream, nullptr);

    std::ofstream output(path);
    output << ir;
    output.close();
}

Instruction* find_store(Instruction* start, const char* target)
{
    auto previous_instruction = start->getPrevNode();

    while (previous_instruction != nullptr)
    {
        // we only want to check store instructions
        if (llvm::isa<StoreInst>(previous_instruction))
        {
            const auto store_instruction = llvm::cast<StoreInst>(previous_instruction);
            const auto target_operand = store_instruction->getOperand(1);
            const auto operand_name = target_operand->getName().data();

            // make sure the operand (register) to be written matches our target
            if (strcmp(operand_name, target) == 0)
                return previous_instruction;
        }

        previous_instruction = previous_instruction->getPrevNode();
    }

    return nullptr;
}

void process(const std::unique_ptr<Module>& program, IRBuilder<>& builder)
{
    const auto function_call = program->getFunction("function_call");
    const auto fmt_str = builder.CreateGlobalStringPtr("dlsym => %p\n", "dlsym_fmt", 0, program.get());
    const auto print = program->getFunction("printf");
    const auto print_checked = program->getFunction("print_checked");

    for (const auto& user : function_call->users())
    {
        // make sure the reference is actually a call instruction
        if (!llvm::isa<CallInst>(user))
            continue;

        const auto call_instruction = llvm::cast<CallInst>(user);
        const auto store_instruction = find_store(call_instruction, "rsi");
        if (store_instruction == nullptr)
            continue;

        const auto rsi = store_instruction->getOperand(1);

        // we want to emit instructions after the store instruction
        builder.SetInsertPoint(store_instruction->getNextNode());
        const auto loaded = builder.CreateLoad(rsi);
        builder.CreateCall(print, { fmt_str, loaded });

        // emit a call to an external checked printf
        const auto ptr_type = Type::getIntNPtrTy(program->getContext(), 8);
        const auto ptr = builder.CreateCast(Instruction::CastOps::IntToPtr, loaded, ptr_type);
        builder.CreateCall(print_checked, { ptr });
    }
}

void create_printf(const std::unique_ptr<Module>& program, IRBuilder<>& builder)
{
    std::vector<Type*> args = { builder.getInt8Ty()->getPointerTo(), builder.getInt64Ty() };
    auto function_type = FunctionType::get(builder.getInt64Ty(), args, false);

    program->getOrInsertFunction("printf", function_type);
}

void create_print_checked(const std::unique_ptr<Module>& program, IRBuilder<>& builder)
{
    std::vector<Type*> args = { builder.getInt8Ty()->getPointerTo() };
    auto function_type = FunctionType::get(builder.getVoidTy(), args, false);

    program->getOrInsertFunction("print_checked", function_type);
}

int main(int argc, char* argv[])
{
    LLVMContext context;
    std::unique_ptr<Module> program = nullptr;
    parse(argv[1], program, context);

    printf("Loaded IR: %s\n", program->getModuleIdentifier().data());

    IRBuilder builder(context);

    create_printf(program, builder);
    create_print_checked(program, builder);
    process(program, builder);

    printf("Verification: %d\n", llvm::verifyModule(*program, &llvm::dbgs()));
    dump(argv[2], program);
 
    return 0;
}
```

As we are compiling with an undefined function we have to seperately generate LLVM IR for it. First things first, let’s create the C code in a file called `utils.cpp`:

```c
#include <cstdio>
#include <cstdint>

extern "C" void print_checked(char* ptr) {
    if ((uint64_t)ptr > 0xffff) {
        printf("dlsym(???, \"%s\");\n", ptr);
    }
}

```

It’s a naive check but it will do the job. Now we have to generate LLVM IR from `utils.cpp`. `clang` can actually do this. In `recompile.sh` add a call to `clang` and then insert the newly created LLVM IR file (`utils.ll`) into the `llvm-link` command. Your `recompile.sh` file should now look like this (unchanged parts ommited):

```bash
clang -S -emit-llvm utils.cpp

/home/layle/orchestra/root/bin/llvm-link \
  -S \
  $1 \
  utils.ll \
  ../../../../../../home/layle/orchestra/root/share/revng/support-x86_64-normal.ll \
  -o \
  $1.linked.ll

# ...

```

Let’s process and then recompile our LLVM IR files again:

```bash
# in orchestra shell
bash lift.sh
dlsym_hook dummy.translated.ll dummy.translated.processed.ll
bash recompile.sh dummy.translated.processed.ll

```

Let’s examine the output:

```
$ ./dummy.translated
dlsym => 0x1
dlsym => 0x42f8c4c8
dlsym(???, ���B);
dlsym => 0x42f8c4c8
dlsym(???, ���B);
dlsym => 0xffff
dlsym => 0x404021
dlsym(???, );
-- test dlsym --
dlsym => 0x4
dlsym => 0x1c78dc0
dlsym(???, "puts");
dlsym => 0x4
test
```

In case you can’t spot it in all the noise: `dlsym(???, "puts");`!

We finally did it! We instrumented our executable in a way that it now dumps strings passed to `dlsym` at runtime without having to place any in-memory hooks. This also means that most anti-debugging tricks are rendered useless. You can find the entire project including the example code on [my GitHub](https://github.com/ioncodes/dlsym_hook).

## Grazie

I’d like to thank [@antoniofrighez](https://twitter.com/antoniofrighez), [@fcremo](https://twitter.com/fcremo) and [@alerevng](https://twitter.com/alerevng) for helping me solve all the roadblocks I encountered while using LLVM and revng. Also huge thank you to the entire [@_revng](https://twitter.com/_revng) team for creating such a wonderful tool.

