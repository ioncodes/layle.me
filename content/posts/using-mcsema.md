---
author: "Layle"
slug: "using-mcsema"
aliases: ["/using-mcsema"]
title: "Lifting binaries to LLVM with McSema"
summary: "This post will guide you through my set up and we’ll explore what worked and what didn’t (maybe it works for you!)."
tags: ["llvm", "lifting", "mcsema"]
date: 2021-07-24T22:00:00Z
draft: false
---


Before embarking on my journey of lifting x64 binaries to LLVM by using revng and eventually my own tooling I worked with McSema which looked very promising. Unfortunately, using McSema wasn’t as straight forward as I had hoped and working with the lifted LLVM IR never really yielded sufficient results. This post will guide you through my set up and we’ll explore what worked and what didn’t (maybe it works for you!). We’ll be using Windows as host system as most of you have IDA Pro for Windows anyways ;) Along with Windows we’ll also be making use of WSL 2, so make sure you have that already set up! Alternatively, a Ubuntu 20.04 LTS VM works too.

## Getting ready

Boot into your Ubuntu instance (may that be WSL 2 or another VM). Make sure you’re able to share files between host and guest.

We’ll need a few dependencies first:

```bash
sudo apt-get update
sudo apt-get upgrade

sudo apt-get install \
     git \
     curl \
     cmake \
     python3 python3-pip python3-virtualenv \
     wget \
     xz-utils pixz \
     clang \
     rpm \
     build-essential \
     gcc-multilib g++-multilib \
     libtinfo-dev \
     lsb-release \
     zip \
     zlib1g-dev \
     ccache \
     llvm

```

Now that we have the dependencies set up, we can execute the following commands (taken from the README) to pull McSema and build it:

```bash
# I used my home directory but feel free to place it wherever you want
cd ~

git clone --depth 1 --single-branch --branch master https://github.com/lifting-bits/remill.git
git clone --depth 1 --single-branch --branch master https://github.com/lifting-bits/mcsema.git

# Get a compatible anvill version
git clone --branch master https://github.com/lifting-bits/anvill.git
( cd anvill && git checkout -b release_bc3183b bc3183b )

export CC="$(which clang)"
export CXX="$(which clang++)"

# Download cxx-common, build Remill. 
./remill/scripts/build.sh --llvm-version 9 --download-dir ./
pushd remill-build
sudo cmake --build . --target install
popd

# Build and install Anvill
mkdir anvill-build
pushd anvill-build
# Set VCPKG_ROOT to whatever directory the remill script downloaded
cmake -DVCPKG_ROOT=$(pwd)/../vcpkg_ubuntu-20.04_llvm-9_amd64 ../anvill
sudo cmake --build . --target install
popd

# Build and install McSema
mkdir mcsema-build
pushd mcsema-build
cmake -DVCPKG_ROOT=$(pwd)/../vcpkg_ubuntu-20.04_llvm-9_amd64 ../mcsema
sudo cmake --build . --target install

pip install ../mcsema/tools

popd

```

Now that McSema is set up we can finally get to lifting binaries! I’ll be using `/bin/cat` with the MD5 `7e9d213e404ad3bb82e4ebb2e1f2c1b3`. Let’s hop over to our Windows host.

## Lifting weights binaries

One of the first things we have to do is recovering a control flow graph. To do this, McSema actually comes with IDAPython scripts. To recover the control flow graph execute the following command in Powershell:

```powershell
# Path to your totally legit IDA Pro installation
$IDA_ROOT = "D:\Reversing\Tools\IDA Pro 7.6\IDA Pro 7.6"
# Path to your cloned McSema repository
$MCSEMA_ROOT = "C:\Users\luca\Documents\Git\mcsema"
# Path to your executable 
$EXECUTABLE_TO_LIFT = "C:\Users\luca\Downloads\cat"
# Path to outputted control flow graph
$CFG_PATH = "C:\Users\luca\Downloads\cat.cfg"

& "$($IDA_ROOT)\ida64.exe" -S"$($MCSEMA_ROOT)\tools\mcsema_disass\ida7\get_cfg.py --output $($CFG_PATH) --log_file \\.\nul --arch amd64 --os linux --entrypoint main --pie-mode --rebase 535822336" $EXECUTABLE_TO_LIFT


```

The arguments should all be self explanatory. However, the argument `--rebase` may not. We need to specify the address to rebase to when we use `--pie-mode` (PIE binaries). This number can be any address, in this example I used `0x1ff00000` in decimal. More information [here](https://github.com/lifting-bits/mcsema/blob/master/docs/McSemaWalkthrough.md#control-flow-recovery).

IDA Pro should pop up. Confirm the architecture and hit “OK”. Once IDA Pro finished recovering the control flow graph verify that you have it in the specified path.

We are now ready to lift the control flow graph to LLVM. To do that execute the following command in your console of choice (make sure you’re in either WSL 2 or in your VM):

```powershell
# cd into the folder that contains cat.cfg
mcsema-lift-9.0 --cfg cat.cfg --output cat.bc --os linux --arch amd64 --explicit_args --merge_segments --name_lifted_sections

```

Alright, we now have the LLVM bitcode file. This is essentially the LLVM IR bitcode of the `cat` binary. Ideally we’d want to look at the LLVM IR in human readable format. To do that execute the following command:

```powershell
llvm-dis cat.bc -o cat.ll

```

Congrats, you finally have lifted your binary to LLVM! Now let’s examine what happens if we try to recompile it back:

```bash
llvm-link cat.ll -o cat.recompiled.bc
# to figure out the libraries to link against use "ldd /bin/cat"
remill-clang-9 -o cat.recompiled cat.recompiled.bc -Wl,--section-start=.section_1ff00000=0x1ff00000

```

Alright, let’s give it a shot:

```
./cat.recompiled helloworld.txt
Segmentation fault (core dumped)
```

Well, that’s a bummer. I figured it’s a hit or miss situation. I tried McSema on some other binaries (mostly CTF challenges) and it seemed to work. However, as soon as I tried instrumenting the IR (by adding simple calls or primitive instructions) every binary started segfaulting again. This may be a mistake on my side, however, at this point I started using revng and ditched McSema entirely. We’ll cover more about that in my next article (with a hands on example!).

That being said: I hope you’ll find more luck with McSema!

