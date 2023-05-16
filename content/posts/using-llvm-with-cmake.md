---
author: "Layle"
slug: "using-llvm-with-cmake"
title: "LLVM with CMake: It's easier than you'd think!"
summary: "Have you ever wondered how you can set up LLVM using CMake? It’s actually easier than you might think. All thanks to an amazing fork of a project called hunter."
tags: ["llvm", "c++", "cmake"]
date: 2021-08-22T22:00:00Z
draft: false
---


Have you ever wondered how you can set up LLVM using CMake? It’s actually easier than you might think. All thanks to an amazing fork of a project called [hunter](https://github.com/LLVMParty/hunter). You may be wondering: “What’s hunter?”. It’s a very easy to use C++ package manager that you can integrate directly into your CMake projects. We’ll be using a fork that is maintained by my friend [@mrexodia](https://github.com/mrexodia). The fork contains definitions for the LLVM project sources.

## A few words

We’ll be using Windows in this example, however, in theory this should also work on any other platform.

## Setting up your project

We’ll be using a very basic “Hello World!” example that uses LLVM. In essence, we’ll be outputting LLVM IR that hosts a `main` function which will call `puts("Hello World!\n")`. I’m using a mixture between WSL2 and Git Bash for some commands. That means, I’ll be using some Linux commands to create files, etc. You are free to use the same set up as I use or use Windows' equivalents.

Let’s create a new project:

```bash
mkdir llvm_hello_world
cd llvm_hello_world
touch CMakeLists.txt
mkdir src
touch .\src\main.cpp
mkdir CMake
touch .\CMake\LLVM.cmake
touch .\CMake\HunterPackages.cmake

```

Your structure should now look like this:

```
layle@ubuntu:~/Projects/llvm_hello_world$ tree
.
├── CMake
│   ├── HunterPackages.cmake
│   └── LLVM.cmake
├── CMakeLists.txt
└── src
    └── main.cpp

```

First things first: `HunterPackages.cmake`. This file will contain the hunter information needed to pull the LLVM package and make it available to us. We’ll be using version 12.0.1 of LLVM as we’ll need this version anyways in future posts ;) Paste the following code into `CMake/HunterPackages.cmake`:

```cmake
# HUNTER_URL is the URL to the latest source code archive on GitHub
# HUNTER_SHA1 is the hash of the downloaded archive

set(HUNTER_URL "https://github.com/LLVMParty/hunter/archive/e71f40b70219c81b955e8112dfbec66d4dba2d75.zip")
set(HUNTER_SHA1 "43D382102BE6A8CF218B79E0C33360EDA58FC4BA")

set(HUNTER_LLVM_VERSION 12.0.1)
set(HUNTER_LLVM_CMAKE_ARGS
        LLVM_ENABLE_CRASH_OVERRIDES=OFF
        LLVM_ENABLE_ASSERTIONS=ON
        LLVM_ENABLE_PROJECTS=clang;lld
        )
set(HUNTER_PACKAGES LLVM)

include(FetchContent)
message(STATUS "Fetching hunter...")
FetchContent_Declare(SetupHunter GIT_REPOSITORY https://github.com/cpp-pm/gate)
FetchContent_MakeAvailable(SetupHunter)

```

Now that we have those set up we can implement `CMake/LLVM.cmake`. Paste the following code:

```cmake
# This is an INTERFACE target for LLVM, usage:
#   target_link_libraries(${PROJECT_NAME} <PRIVATE|PUBLIC|INTERFACE> LLVM)
# The include directories and compile definitions will be properly handled.

set(CMAKE_FOLDER_LLVM "${CMAKE_FOLDER}")
if(CMAKE_FOLDER)
    set(CMAKE_FOLDER "${CMAKE_FOLDER}/LLVM")
else()
    set(CMAKE_FOLDER "LLVM")
endif()

# Find LLVM
find_package(LLVM REQUIRED CONFIG)

message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")
message(STATUS "Using LLVMConfig.cmake in: ${LLVM_DIR}")

# Split the definitions properly (https://weliveindetail.github.io/blog/post/2017/07/17/notes-setup.html)
separate_arguments(LLVM_DEFINITIONS)

# Some diagnostics (https://stackoverflow.com/a/17666004/1806760)
message(STATUS "LLVM libraries: ${LLVM_LIBRARIES}")
message(STATUS "LLVM includes: ${LLVM_INCLUDE_DIRS}")
message(STATUS "LLVM definitions: ${LLVM_DEFINITIONS}")
message(STATUS "LLVM tools: ${LLVM_TOOLS_BINARY_DIR}")

add_library(LLVM INTERFACE)
target_include_directories(LLVM SYSTEM INTERFACE ${LLVM_INCLUDE_DIRS})
target_link_libraries(LLVM INTERFACE ${LLVM_AVAILABLE_LIBS})
target_compile_definitions(LLVM INTERFACE ${LLVM_DEFINITIONS} -DNOMINMAX)

set(CMAKE_FOLDER "${CMAKE_FOLDER_LLVM}")
unset(CMAKE_FOLDER_LLVM)

```

Alright, now we should have LLVM fully exposed to our project. All we have to do now is build against it. To do this we have to hop over to our `CMakeLists.txt` and insert a fairly standard version of a `CMakeLists` file.

```cmake
cmake_minimum_required(VERSION 3.19)

include(CMake/HunterPackages.cmake)

project(llvm_hello_world)

# Enable solution folder support
set_property(GLOBAL PROPERTY USE_FOLDERS ON)

# Append the CMake module search path so we can use our own modules
list(APPEND CMAKE_MODULE_PATH ${CMAKE_CURRENT_LIST_DIR}/CMake)

# Require C++20
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# LLVM wrapper
include(CMake/LLVM.cmake)

# MSVC-specific options
if(MSVC)
    # This assumes the installed LLVM was built in Release mode
    set(CMAKE_C_FLAGS_RELWITHDEBINFO "/ZI /Od /Ob0 /DNDEBUG" CACHE STRING "" FORCE)
    set(CMAKE_CXX_FLAGS_RELWITHDEBINFO "/ZI /Od /Ob0 /DNDEBUG" CACHE STRING "" FORCE)

    if(${LLVM_USE_CRT_RELEASE} STREQUAL "MD")
        set(CMAKE_MSVC_RUNTIME_LIBRARY MultiThreadedDLL)
    elseif(${LLVM_USE_CRT_RELEASE} STREQUAL "MT")
        set(CMAKE_MSVC_RUNTIME_LIBRARY MultiThreaded)
    else()
        message(FATAL_ERROR "Unsupported LLVM_USE_CRT_RELEASE=${LLVM_USE_CRT_RELEASE}")
    endif()
endif()

add_executable(${PROJECT_NAME} src/main.cpp)

# Link against LLVM
target_link_libraries(${PROJECT_NAME} PRIVATE LLVM)

# Set the plugin as the startup project
set_property(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR} PROPERTY VS_STARTUP_PROJECT ${PROJECT_NAME})

```

We should be all set now! To test our build system with an IDE execute the commands below. If you want to use VSCode: open the project root folder and configure the project using whatever kit you want. I personally like to use the “Visual Studio Community 2019 Release - amd64” kit most of the time. In this case, skip the commands once you’ve configured your project.

```bash
mkdir build
cd build
cmake ..

```

Keep in mind that this might take a while if it’s your first time configuring LLVM using hunter. Now that we have everything set up we can go ahead and create a simple example.

## Hello world LLVM!

Let’s jump into our C++ source file `main.cpp`. We should first define a raw skeleton. That is, the includes, types we need and our `main` function:

```cpp
#include <llvm/IR/Module.h>
#include <llvm/IR/PassManager.h>
#include <llvm/IR/IRBuilder.h>

#include <vector>
#include <memory>

using llvm::LLVMContext;
using llvm::IRBuilder;
using llvm::Module;
using llvm::FunctionType;
using llvm::Function;
using llvm::BasicBlock;
using llvm::Type;
using llvm::ArrayRef;

int main(int argc, char* argv[])
{
    return 0;
}
```

The first thing we have to do is create a `Module` which is the host of all of our definitions such as imports, exports, functions, basic blocks, etc. We also need a `IRBuilder` which is the object allowing us to interact with the instructions, basic blocks and types. Note that I’m providing a rough TLDR, for more information always consult the LLVM documentation.

```cpp
LLVMContext context;
IRBuilder builder(context);
const auto module = std::make_unique<Module>("hello_llvm", context); // hello_llvm => module name

```

Before we can create basic blocks we have to create a function and it’s type. In LLVM we can use the classes `FunctionType` and `Function`. We have to define our `main` function first (the entrypoint to our program). A simple `void main();` should suffice for that:

```cpp
// builder.getVoidTy() => void main() {
const auto func_type = FunctionType::get(builder.getVoidTy(), false);
const auto main_func = Function::Create(func_type, Function::ExternalLinkage, "main", module.get());

```

Now that we have our `main` function set up we can finally create our first basic block.

```cpp
// main_func being the parent of the basic block
const auto entry = BasicBlock::Create(context, "entrypoint", main_func);
builder.SetInsertPoint(entry); // set instruction insertion point to this basic block

```

You may be wondering how we are going to use an external function such as `puts` from within LLVM. It’s actually quite simple. All we have to do is create another function definition and a definition for the arguments. `puts` is defined as `int puts(const char *s);`, let’s implement this in LLVM:

```cpp
// builder.getInt8Ty()->getPointerTo() => char*, a pointer to the null terminated string
const std::vector<Type*> puts_args = { builder.getInt8Ty()->getPointerTo() };
const ArrayRef puts_args_ref(puts_args);

// builder.getInt32Ty() => uint32_t, the return type
const auto puts_type = FunctionType::get(builder.getInt32Ty(), puts_args_ref, false);
const auto puts_func = module->getOrInsertFunction("puts", puts_type);

```

There’s only two more things to implement to get a working example: Creating a global string containing “Hello LLVM!” and inserting instructions into the basic block.

```cpp
auto str = builder.CreateGlobalStringPtr("Hello LLVM!\n");

// equivalent to: puts("Hello LLVM!"); return;
builder.CreateCall(puts_func, { str });
builder.CreateRetVoid(); // in LLVM, blocks need a terminator

```

That’s it! Let’s have a look at the generated IR. To do this call `module->dump()`. Here you can find the full source code:

```cpp
#include <llvm/IR/Module.h>
#include <llvm/IR/PassManager.h>
#include <llvm/IR/IRBuilder.h>

#include <vector>
#include <memory>

using llvm::LLVMContext;
using llvm::IRBuilder;
using llvm::Module;
using llvm::FunctionType;
using llvm::Function;
using llvm::BasicBlock;
using llvm::Type;
using llvm::ArrayRef;

int main(int argc, char* argv[])
{
    LLVMContext context;
    IRBuilder builder(context);
    const auto module = std::make_unique<Module>("hello_llvm", context);

    const auto func_type = FunctionType::get(builder.getVoidTy(), false);
    const auto main_func = Function::Create(func_type, Function::ExternalLinkage, "main", module.get());

    const auto entry = BasicBlock::Create(context, "entrypoint", main_func);
    builder.SetInsertPoint(entry);

    const std::vector<Type*> puts_args = { builder.getInt8Ty()->getPointerTo() };
    const ArrayRef puts_args_ref(puts_args);

    const auto puts_type = FunctionType::get(builder.getInt32Ty(), puts_args_ref, false);
    const auto puts_func = module->getOrInsertFunction("puts", puts_type);

    auto str = builder.CreateGlobalStringPtr("Hello LLVM!\n");

    builder.CreateCall(puts_func, { str });
    builder.CreateRetVoid();

    module->dump();

    return 0;
}

```

You should see something along the lines of:

```llvm
; ModuleID = 'hello_llvm'
source_filename = "hello_llvm"

@0 = private unnamed_addr constant [13 x i8] c"Hello LLVM!\0A\00", align 1

define void @main() {
entrypoint:
  %0 = call i32 @puts(i8* getelementptr inbounds ([13 x i8], [13 x i8]* @0, i32 0, i32 0))
  ret void
}

declare i32 @puts(i8* %0)

```

If you are interested in generating an executable from the IR, save it to a file called `hello_llvm.ll` and execute the following commands:

```powershell
$LLVM12_PATH = "C:\.hunter\_Base\Cellar\204034a1dbe9cf2995b07fc1f3542b939059d116\204034a\raw\bin"
& "$($LLVM12_PATH)\llvm-link.exe" .\hello_llvm.ll -o hello_llvm.bc
& "$($LLVM12_PATH)\llc.exe" -filetype=obj .\hello_llvm.bc
& "$($LLVM12_PATH)\clang.exe" .\hello_llvm.obj -o hello_llvm.exe
.\hello_llvm.exe
Hello LLVM!

```

Congrats! You’ve just set up LLVM using CMake for the first time and created your first functional “Hello World!” equivalent using LLVM IR :)

