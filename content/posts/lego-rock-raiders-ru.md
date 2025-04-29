---
author: "Layle"
slug: "lego-rock-raiders-ru"
title: "A Story about a Russian DRM and Lego Rock Raiders"
summary: "I was approached by \"The Research Realm\" - a collective aiming to preserve Lego's history - to create a No-CD crack and fix for a rare version of Lego Rock Raiders."
tags: ["reverse-engineering", "drm"]
date: 2025-04-28T18:00:00Z
weight: 1
draft: true
---

This weekend I've been approached by [The Research Realm](https://researchrealm.net/), a group of people who aim to preserve Lego's history, to create a [No-CD crack](https://github.com/ioncodes/LRR_RU_NOCD) and fix a bug in the game that prevented any player from progressing in the Russian version of the game Lego Rock Raiders. In this blog post, I'll take you through the entire process of doing this, step by step, including all the mistakes I've made along the way in a story-telling fashion.

## Background
Based on the information I was provided, I thought 2 separate issues took place in the game:
1. A CD check prevents the game from being played without a mounted ISO/CD
   ![](/images/lrr-ru/cdmsgbox.png)
2. A bug would prevent the player from progressing the game as it was not possible to upgrade the "base" in-game
   <video width="600" controls>
    <source src="/videos/lrr-ru/upgrade-base-bug.mp4" type="video/mp4">
    Your browser does not support the video tag.
   </video>

Notice how in the video, the rock count doesn't decrease - normally, upon upgrading the base, it should play an animation as well as subtract the appropriate amount of rocks. Without this feature, it's not possible to progress in the game. At the time, I thought this was likely some obscure bug, perhaps a "normal" bug within the game itself; however, the bug would never cause any issues due to some inconsistency between older versions of Windows and modern ones (as seen in multiple older titles).

## The CD Check
Opening up the `LegoRR.exe` binary in your favorite decompiler and going to the `WinMain` function will reveal what's going on fairly quickly (... or does it?):

![](/images/lrr-ru/winmain.png)

That looks fairly straightforward, doesn't it? Let's summarize:
1. Loop through some drive letters
2. For each drive letter, call `GetDriveTypeA` and check whether it returns `DRIVE_CDROM` (5)
3. If it does, call `GetVolumeInformationA` and compare `VolumeNameBuffer` and `FileSystemNameBuffer` to known values

The known values are:
* `VolumeNameBuffer` = `ROCKRAIDERS`
* `FileSystemNameBuffer` = `CDFS`

The rest of `WinMain` calls some more functions, but I wasn't interested in that yet - all I wanted was to bypass the message box (the call to `MessageBoxA` in the following screenshot) and progress into the game.

![](/images/lrr-ru/winmainrest.png)

During debugging, I noticed that I wasn't able to set normal breakpoints as the game would eventually break the stack and execute a bogus address. I thought that it was likely due to some sort of integrity check (bonus points if you were already able to spot it in the screenshot) but didn't bother with it since I could just use hardware breakpoints. For some context: Software breakpoints overwrite a byte at the target location and set it to `0xCC`, which is the equivalent of `int3` to cause an exception.  

However, knowing that I can't patch the code itself, I had to think of a "strategy" on how to implement these patches without making any changes to the `.text` section of `LegoRR.exe`.

## Bypassing the CD Check
You probably already knew the solution: Hooking the API calls! This will change the code within `kernel32.dll`, but since the game doesn't verify the integrity of that DLL, we can just modify it as we please. Now we just need a target DLL to replace on disk. Chances are, if you've already reversed older games, you've already seen the DLL `d3drm.dll`. It's a perfect candidate for our scenario. Next step is creating a new C/C++ project along with my favorite hooking library [MinHook](https://github.com/TsudaKageyu/minhook).  

Since we're proxying `d3drm.dll`, we have to rename the original DLL to something else, and then rename our crack to `d3drm.dll`. I chose to name the original DLL `d3drm_ori.dll`. We first tell the linker to forward the exports of the original DLL:

```c
#pragma comment(linker, "/export:D3DRMColorGetAlpha=d3drm_ori.D3DRMColorGetAlpha,@1")
#pragma comment(linker, "/export:D3DRMColorGetBlue=d3drm_ori.D3DRMColorGetBlue,@2")
#pragma comment(linker, "/export:D3DRMColorGetGreen=d3drm_ori.D3DRMColorGetGreen,@3")
#pragma comment(linker, "/export:D3DRMColorGetRed=d3drm_ori.D3DRMColorGetRed,@4")
#pragma comment(linker, "/export:D3DRMCreateColorRGB=d3drm_ori.D3DRMCreateColorRGB,@5")
#pragma comment(linker, "/export:D3DRMCreateColorRGBA=d3drm_ori.D3DRMCreateColorRGBA,@6")
#pragma comment(linker, "/export:D3DRMMatrixFromQuaternion=d3drm_ori.D3DRMMatrixFromQuaternion,@7")
#pragma comment(linker, "/export:D3DRMQuaternionFromRotation=d3drm_ori.D3DRMQuaternionFromRotation,@8")
#pragma comment(linker, "/export:D3DRMQuaternionMultiply=d3drm_ori.D3DRMQuaternionMultiply,@9")
#pragma comment(linker, "/export:D3DRMQuaternionSlerp=d3drm_ori.D3DRMQuaternionSlerp,@10")
#pragma comment(linker, "/export:D3DRMVectorAdd=d3drm_ori.D3DRMVectorAdd,@11")
#pragma comment(linker, "/export:D3DRMVectorCrossProduct=d3drm_ori.D3DRMVectorCrossProduct,@12")
#pragma comment(linker, "/export:D3DRMVectorDotProduct=d3drm_ori.D3DRMVectorDotProduct,@13")
#pragma comment(linker, "/export:D3DRMVectorModulus=d3drm_ori.D3DRMVectorModulus,@14")
#pragma comment(linker, "/export:D3DRMVectorNormalize=d3drm_ori.D3DRMVectorNormalize,@15")
#pragma comment(linker, "/export:D3DRMVectorRandom=d3drm_ori.D3DRMVectorRandom,@16")
#pragma comment(linker, "/export:D3DRMVectorReflect=d3drm_ori.D3DRMVectorReflect,@17")
#pragma comment(linker, "/export:D3DRMVectorRotate=d3drm_ori.D3DRMVectorRotate,@18")
#pragma comment(linker, "/export:D3DRMVectorScale=d3drm_ori.D3DRMVectorScale,@19")
#pragma comment(linker, "/export:D3DRMVectorSubtract=d3drm_ori.D3DRMVectorSubtract,@20")
#pragma comment(linker, "/export:Direct3DRMCreate=d3drm_ori.Direct3DRMCreate,@21")
#pragma comment(linker, "/export:DllCanUnloadNow=d3drm_ori.DllCanUnloadNow,@22")
#pragma comment(linker, "/export:DllGetClassObject=d3drm_ori.DllGetClassObject,@23")
```

Now all that's required is creating the hooks:

```c++
decltype(GetVolumeInformationA)* g_OriginalGetVolumeInformationA = nullptr;
decltype(GetDriveTypeA)* g_OriginalGetDriveTypeA = nullptr;

// ...

BOOL WINAPI GetVolumeInformationA_hk(
    LPCSTR lpRootPathName,
    LPSTR lpVolumeNameBuffer,
    DWORD nVolumeNameSize,
    LPDWORD lpVolumeSerialNumber,
    LPDWORD lpMaximumComponentLength,
    LPDWORD lpFileSystemFlags,
    LPSTR lpFileSystemNameBuffer,
    DWORD nFileSystemNameSize
)
{
    BOOL result = g_OriginalGetVolumeInformationA(
        lpRootPathName,
        lpVolumeNameBuffer,
        nVolumeNameSize,
        lpVolumeSerialNumber,
        lpMaximumComponentLength,
        lpFileSystemFlags,
        lpFileSystemNameBuffer,
        nFileSystemNameSize
    );

    std::cout << "GetVolumeInformationA(...) -> " << result << std::endl;
    std::cout << "  lpRootPathName: " << lpRootPathName << std::endl;

    if (strcmp(lpRootPathName, "C:\\") == 0)
    {
        // Spoof the volume name and file system name, the Russian version for some reason only checks this.
        if (lpVolumeNameBuffer && nVolumeNameSize > 0)
            strncpy_s(lpVolumeNameBuffer, nVolumeNameSize, "ROCKRAIDERS", nVolumeNameSize - 1);
        if (lpFileSystemNameBuffer && nFileSystemNameSize > 0)
            strncpy_s(lpFileSystemNameBuffer, nFileSystemNameSize, "CDFS", nFileSystemNameSize - 1);

        std::cout << "  lpVolumeNameBuffer: " << (lpVolumeNameBuffer ? lpVolumeNameBuffer : "NULL") << std::endl;
        std::cout << "  lpFileSystemNameBuffer: " << (lpFileSystemNameBuffer ? lpFileSystemNameBuffer : "NULL") << std::endl;

        std::cout << "Spoofed CD volume information" << std::endl;
    }

    return result;
}

UINT WINAPI GetDriveTypeA_hk(LPCSTR lpRootPathName)
{
    UINT result = g_OriginalGetDriveTypeA(lpRootPathName);

    // The game will eventually call this but it can't ever exist, so we'll just use this
    if (strcmp(lpRootPathName, "C:\\") == 0)
    {
        std::cout << "Spoofing as CDROM drive" << std::endl;
        result = DRIVE_CDROM;
    }

    std::cout << "GetDriveTypeA(\"" << lpRootPathName << "\") -> " << result << std::endl;

    return result;
}

// ...

if (MH_Initialize() != MH_OK)
    std::cout << "Failed to initialize MinHook" << std::endl;

if (MH_CreateHookApi(
    L"kernel32.dll",
    "GetVolumeInformationA",
    GetVolumeInformationA_hk,
    reinterpret_cast<LPVOID*>(&g_OriginalGetVolumeInformationA)
) != MH_OK)
    std::cout << "Failed to create hook for GetVolumeInformationA" << std::endl;
if (MH_CreateHookApi(
    L"kernel32.dll",
    "GetDriveTypeA",
    GetDriveTypeA_hk,
    reinterpret_cast<LPVOID*>(&g_OriginalGetDriveTypeA)
) != MH_OK)
    std::cout << "Failed to create hook for GetDriveTypeA" << std::endl;
```

We don't do anything fancy here, we're just creating hooks for `GetVolumeInformationA` and `GetDriveTypeA`. The hooks then replace the "wrong" information with the expected information:
* `GetDriveTypeA` now returns `DRIVE_CDROM` for the drive `C:\`
* `GetVolumeInformationA` now copies `ROCKRAIDERS` and `CDFS` to the corresponding buffers

With this in place, and both DLLs (`d3drm.dll`, our proxy DLL; and `d3drm_ori.dll`, the original DLL) in the installation folder, we can successfully get to the video mode selection window (and thus also into the game).

![](/images/lrr-ru/videomodescreen.png)

With that, we've reached our first milestone - we're able to bypass the CD check (for now). I was actually going to stop here, but I eventually decided I couldn't resist and started looking into the upgrade bug as well...

## Finding ~~Nemo~~ the Bug
Finding a specific place in code, especially inside of a large game engine, is usually a difficult task; however, I had multiple options here.

### Fail #1
My first approach was looking through all known variants (read: languages) of the game and checking the timestamp and filesize of `LegoRR.exe`. My hypothesis was that if I find a file that's similar enough, I may be able to just diff them against each other to find any changes that might catch my eye. Turns out the Japanese version is only 1 month "younger" while being 1kb bigger than the Russian version. I used IDA Pro 9.1 and [Diaphora](https://github.com/joxeankoret/diaphora) to create the diffs:

![](/images/lrr-ru/diaphora.png)

There was this one function that had a very low match ratio (literally the lowest) and looked very strange; however, at first glance in the decompilation, I figured it's nothing worth investigating. Oh, how I was wrong...

![](/images/lrr-ru/weirddiaphora.png)

However, we did learn something important: These 2 versions are very similar to each other, so it may be possible to find something in one version and then trace it back to the other with a patternscan? We can't use the Russian one, since we know that this one is bugged, so I opted for debugging the Japanese and German versions instead.

### CheatEngine for the Win
So with that first approach not yielding anything, I dusted off [CheatEngine](https://www.cheatengine.org/) with the gameplan to scan for the rock value. Once we have the address of the rock counter in memory, we can then intercept all *writes* (subtractions in this case) to it. Once we find this code, we can just look for the same code in the Russian version. These are the steps I followed:

1. Open CheatEngine and attach it to the German version
2. Start the 5th tutorial mission (3rd menu option, then character holding TNT)
3. While the character collects rocks, scan for the rock counter (3, then 4, then 5, then 6)
4. With the rock counter address, we "Find out what writes to this address" (see right click context menu in Cheat Engine)
5. Upgrade the base, which should now subtract 5 rocks from the rock counter -> causes a write

![](/images/lrr-ru/cheatenginetrace.png)

I also traced general accesses to the address and was able to find all of these:

```py
# reads
00423B8C - 8B 81 A0000000  - mov eax,[ecx+000000A0]
004561E5 - 8B 80 A0000000  - mov eax,[eax+000000A0]

# writes
0041F989 - FF 80 A0000000  - inc [eax+000000A0]      # rock collected
0041F92D - 29 88 A0000000  - sub [eax+000000A0],ecx  # after 5 rocks are subtracted when performing the upgrade
```

Let's see what's happening at `0041F92D`:

```c
int __cdecl removerocks(int a1, int a2)
{
  if ( dword_5570D4 )
  {
    if ( a1 )
      *((_DWORD *)dword_5570D4 + 43) -= a2;
    else
      *((_DWORD *)dword_5570D4 + 40) -= a2;
  }
  if ( a1 )
    return sub_45C840(0, 5);
  else
    return sub_45C840(0, a2);
}
```

Seems simple enough to just search for the same code in the Russian version, right? My preferred method is to actually export the to-be-searched game version as C decompilation and then search a string like `-= a2` (something that's simple enough to be universal) in the Russian version. That yielded the following code:

```c
void __cdecl sub_41F9B0(int a1, int a2)
{
  if ( dword_558554 )
  {
    if ( a1 )
      *((_DWORD *)dword_558554 + 43) -= a2;
    else
      *((_DWORD *)dword_558554 + 40) -= a2;
  }
  if ( a1 )
    sub_45C580(0, 5);
  else
    sub_45C580(0, a2);
}
```

Literally the same, awesome! Now with this in place to check all xrefs and noticed that one of them is that weird location function we saw with Diaphora earlier, the one with the `GetModuleHandleA("DECO_24.DLL")`. Set a breakpoint, play the TNT tutorial again, and voilà, we got a hit!

![](/images/lrr-ru/deco24bphit.png)

But what's happening here? The decompilation doesn't reveal a call to the subtraction function, so how come we have an xref? The decompilation reads:

```c
int __usercall sub_438699@<eax>(int a1@<eax>, int a2@<ebp>)
{
  int result; // eax
  HMODULE ModuleHandleA; // eax
  int v4; // ecx
  _DWORD *v5; // esi
  int v6; // eax

  *(_DWORD *)(a2 - 8) = a1;
  cdkeydriveletter = 0;
  result = *(_DWORD *)(a2 + 12);
  if ( result || *(_UNKNOWN **)(a2 - 8) == &loc_41321B )
  {
    ModuleHandleA = GetModuleHandleA("DECO_24.DLL");
    v4 = 6298;
    v5 = ModuleHandleA + 1024;
    v6 = 0;
    do
    {
      v6 += *v5;
      v5 = (_DWORD *)((char *)v5 + 1);
      --v4;
    }
    while ( v4 );
    result = 0;
    __writefsdword(0, 0);
  }
  return result;
}
```

Let's examine the disassembly, in particular the basic block right before the `ret`:

![](/images/lrr-ru/hiddencode.png)

Notice the following sequence:

```x86asm
mov edx, 4386FAh
push edx
; ...
retn
```

As we know, a `ret` pops from the stack and jumps to that location. IDA isn't able to deduce this and ends up not displaying the rest of the code. I didn't do this personally, but you could technically patch out these sequences with NOP slides which would restore the decompilation like so:

```x86asm
.text:004386E5 | pop     esi
.text:004386E6 | nop
.text:004386E7 | nop
.text:004386E8 | nop
.text:004386E9 | nop
.text:004386EA | nop
.text:004386EB | push    edx
.text:004386EC | sub     eax, 0BC13601Fh
.text:004386F1 | sub     [esp+4+var_4], eax
.text:004386F4 | xor     eax, eax
.text:004386F6 | nop
.text:004386F7 | nop
.text:004386F8 | nop
.text:004386F9 | nop
.text:004386FA | jmp     short loc_438706
```

```c
// positive sp value has been detected, the output may be wrong!
int __usercall sub_438699@<eax>(int a1@<eax>, int a2@<ebp>)
{
  double v2; // st7
  int result; // eax
  HMODULE ModuleHandleA; // eax
  int v5; // ecx
  _DWORD *v6; // esi
  int v7; // eax
  int v8; // ecx
  char (__cdecl *v9)(int, int, int); // esi
  int v10; // eax
  int *v11; // esi
  int v12; // eax
  int v13; // ecx
  _DWORD *v14; // eax
  int v15; // edx
  _DWORD *v16; // eax

  *(_DWORD *)(a2 - 8) = a1;
  cdkeydriveletter = 0;
  result = *(_DWORD *)(a2 + 12);
  if ( result || *(_UNKNOWN **)(a2 - 8) == &loc_41321B )
  {
    ModuleHandleA = GetModuleHandleA("DECO_24.DLL");
    v5 = 6298;
    v6 = ModuleHandleA + 1024;
    v7 = 0;
    do
    {
      v7 += *v6;
      v6 = (_DWORD *)((char *)v6 + 1);
      --v5;
    }
    while ( v5 );
    v8 = byte_4386FD - (char *)sub_401000;
    v9 = sub_401000;
    v10 = 0;
    do
    {
      v10 += *(_DWORD *)v9;
      v9 = (char (__cdecl *)(int, int, int))((char *)v9 + 1);
      --v8;
    }
    while ( v8 );
    result = 0;
    v11 = *(int **)(a2 + 8);
    if ( *v11 == 4 )
    {
      result = sub_4385F0(v11, (_DWORD *)(a2 - 4));
      if ( result )
      {
        v12 = *(_DWORD *)(a2 - 4);
        v13 = v12;
        if ( !v12 )
          v13 = dword_559418;
        sub_41F9B0(v12 != 0, v13); // THIS IS THE CALL TO THE SUBTRACT
        v14 = (_DWORD *)v11[6];
        v15 = v11[204] + 1;
        v11[246] = 0;
        sub_4088D0(v2, v14, v15);
        sub_469D20(v11, v11[204] + 1);
        v16 = sub_44A140(v11);
        sub_4755E0(v16, 0, a2 - 20);
        sub_40CCB0(9, a2 - 20, 0);
        return sub_418800(*v11, v11[1], v11[204], 0);
      }
    }
  }
  return result;
}
```

Fun fact: At the time, I actually wasn't sure if that was some sort of very basic obfuscation or just some super weird compiler quirk (early MSVC versions did some very strange things, so I wouldn't be surprised).

![](/images/lrr-ru/funfact.png)

By the way, this is your second chance to spot the integrity check on your own - sadly I was too tired at this point to notice myself. :')

So what's preventing the game from calling it? We have to notice the first condition:

```c
if ( result || *(_UNKNOWN **)(a2 - 8) == &loc_41321B )
// which is just:
if ( result || *(_DWORD *)(a2 - 8) == 0x41321B )
```

Whenever I see a condition like this, my first instinct is to just invert the condition and see what happens...

![](/images/lrr-ru/neuronactivation.png)


## Fighting the DRM
... a crash is what happens. Almost instantly on startup.

![](/images/lrr-ru/fixedit.png)

Since I was patching the binary to invert the check and that exhibited the same behavior as the software breakpoints, I was fairly confident I was dealing with some sort of integrity check. Luckily, it's not that difficult to figure out what actually checks it. x64dbg supports memory breakpoints, which is exactly what I did. I set a memory read breakpoint on `0x004386A8` (the address I patched) and let the game run again.

![](/images/lrr-ru/memoryreadbp.png)

It takes a while, but eventually the debugger will break at the following location:

```x86asm
004781FB | 33C0        | xor eax,eax                 
004781FD | 0306        | add eax,dword ptr ds:[esi]       ; breakpoint triggered here
004781FF | 46          | inc esi                     
00478200 | 49          | dec ecx                     
00478201 | 75 FA       | jne legorr.4781FD                ; loop back to 004781FD
00478203 | 5E          | pop esi                     
00478204 | BA 1B824700 | mov edx,legorr.47821B       
00478209 | 52          | push edx                    
0047820A | BA E4814700 | mov edx,legorr.4781E4       
0047820F | 2B42 04     | sub eax,dword ptr ds:[edx+4]     ; checksum -= known_value
00478212 | 290424      | sub dword ptr ss:[esp],eax       ; [esp] -= checksum
00478215 | 33C0        | xor eax,eax                 
00478217 | 64:8900     | mov dword ptr fs:[eax],eax  
0047821A | C3          | ret                         
```

Reading the disassembly (I omitted a few things) reveals a loop that increments from address A to B and adds the 32bit value located at said address to a counter. This counter is then subtracted by a known value, and the result is then used to subtract the value that `ESP` points at. `ESP` "just so happens" to point to the next function executed. Therefore, if the checksum (the counter) does not match the predetermined value, the subtraction will be non-zero, which in turn means the first 4 bytes of the next function are subtracted by the leftover amount. Short pseudocode:

```c
for (int i = 0; i < SIZE; i++) {
    checksum += *(DWORD*)(BASE_ADDR + i);
}
checksum -= KNOWN_VALUE;
[ESP] -= checksum;

// [ESP] -> points to next function call, will break if checksum isn't 0
```

That... looks familiar, doesn't it? That's because we've seen this 3 times already. Taken from the last decompilation:

```c
v8 = byte_4386FD - (char *)sub_401000;
v9 = sub_401000;
v10 = 0;
do
{
    v10 += *(_DWORD *)v9;
    v9 = (char (__cdecl *)(int, int, int))((char *)v9 + 1);
    --v8;
}
```

I naively copied the byte sequence at the end which is `2B 42 04 29 04 24 33 C0 64 89 00` and added a function that replaces the `sub dword ptr ss:[esp],eax` with 3 NOPs.

```c
VOID NopChecksumCheck(BYTE* pAddress, size_t size)
{
    DWORD oldProtect;
    VirtualProtect(pAddress, size, PAGE_EXECUTE_READWRITE, &oldProtect);
    for (size_t i = 0; i < size; ++i)
        pAddress[i] = 0x90; // NOP
    VirtualProtect(pAddress, size, oldProtect, &oldProtect);
}

NopChecksumCheck(reinterpret_cast<BYTE*>(0x00478212), 3); // WinMain
std::cout << "Patched checksum check (WinMain)" << std::endl;

NopChecksumCheck(reinterpret_cast<BYTE*>(0x00479916), 3); // TimerFunc
std::cout << "Patched checksum check (TimerFunc)" << std::endl;

NopChecksumCheck(reinterpret_cast<BYTE*>(0x0043872B), 3); // Right before upgrading the base
std::cout << "Patched checksum check (Base Upgrade)" << std::endl;
```

There were a total of 3 locations I was able to identify with the given signature/pattern:
1. Within the WinMain function
2. Within a timer function that gets called periodically
3. Just before the base gets upgraded / the rocks subtracted

I built a new version of the DLL and passed it along for testing as I seemed to be able to at least pass the TNT tutorial now. So at this point, the base upgrade actually works! Wow!

<video width="600" controls>
<source src="/videos/lrr-ru/upgrade-base-fixed.mp4" type="video/mp4">
Your browser does not support the video tag.
</video>

## Exception Madness

![](/images/lrr-ru/morebugs.png)

So there are more bugs... But why? There's one thing I haven't told you about yet: `cd.key`. I thought perhaps I should invest some time into checking what this is about. I ignored it up until now as the game just worked fine, even without that file. The CD contains a file in `Data\cd.key` that is sort of like a CD license key... but not really, the contents are ignored entirely and it ships with `0xDEAD`. Cross-referencing the string revealed 2 locations, one of which seemed interesting as it loops through possible drive letters until it finds the `cd.key` file and then caches the drive letter where the file had been identified:

```c
int sub_4800F0()
{
  CHAR driveletter; // bl
  FILE *handle; // eax
  unsigned __int8 driveletter_1; // [esp+8h] [ebp-10Ch]
  CHAR RootPathName[4]; // [esp+Ch] [ebp-108h] BYREF
  char Buffer[260]; // [esp+10h] [ebp-104h] BYREF

  driveletter = 'C';
  strcpy(RootPathName, "A:\\");
  driveletter_1 = 'C';
  while ( 1 )
  {
    RootPathName[0] = driveletter;
    if ( GetDriveTypeA(RootPathName) == DRIVE_CDROM )
    {
      sprintf(Buffer, "%c:\\%s\\%s", driveletter_1, Path, aCdKey);
      handle = fopen(Buffer, Mode);
      if ( handle )
        break;
    }
    driveletter_1 = ++driveletter;
    if ( (unsigned __int8)driveletter > 'Z' )
      return 0;
  }
  fclose(handle);
  LOBYTE(cddrive_letter) = driveletter;
  return 1;
}
```

Since I'm returning `DRIVE_CDROM` for the drive `C:\` due to my `GetDriveTypeA` hook, this function would set `cddrive_letter` to `C`. That means the supposed path would be `C:\Data\cd.key`; however, adding the file here didn't seem to change anything. Why not?

Checking xrefs to `cddrive_letter` showed one particular location which is extra suspicious given that during debugging the game keeps causing a software breakpoint exception at least once a second.

```c
__int64 __usercall sub_4799C0@<edx:eax>(int a1@<ebx>, int a2@<edi>, int a3@<esi>)
{
  __int64 result; // rax
  int v4; // ecx
  _DWORD v5[5]; // [esp-14h] [ebp-2Ch] BYREF
  CPPEH_RECORD ms_exc; // [esp+0h] [ebp-18h]

  ms_exc.registration.ExceptionHandler = (PVOID)-1;
  ms_exc.registration.Next = (struct _EH3_EXCEPTION_REGISTRATION *)&stru_49FBA0;
  ms_exc.exc_ptr = (EXCEPTION_POINTERS *)_except_handler3;
  v5[2] = a1;
  v5[1] = a3;
  v5[0] = a2;
  ms_exc.old_esp = (DWORD)v5;
  ms_exc.registration.TryLevel = 0;
  result = causeint3((unsigned __int8)a1 + 86);
  *(_DWORD *)result += v4;
  return result;
}
```

Nothing here, right? Well, we learned our lesson. Let's dive into the disassembly:

![](/images/lrr-ru/seh.png)

You're looking at a function that sets up a [Structured Exception Handler (SEH)](https://learn.microsoft.com/en-us/cpp/cpp/structured-exception-handling-c-cpp?view=msvc-170) (in fact, you're looking at pre-SEH3/legacy SEH used back in older MSVC versions). In C this would roughly translate to:

```c
__try {
    causeint3(); // this is basically a int3 (__debugbreak() intrinsic)
} __except {
    cdkeydriveletter = cddrive_letter;
}
```

Since software interrupts (`int3`) are treated as an exception, the `__except` block will be triggered. This is likely included as an anti-debug measure as debuggers may catch these exceptions and not pass them on. In case the exception isn't passed on, the game would never set `cdkeydriveletter`, which is later used. Where is this function called? In multiple locations actually, but this one answers why the exception is caused all the time:

```c
void __usercall TimerFunc(int a1@<ebx>, int a2@<edi>, int a3@<esi>, CHAR a4, __int16 a5)
{
  HMODULE ModuleHandleA; // eax
  int v6; // ecx
  _DWORD *v7; // esi
  int v8; // eax
  setscdkeydriveletterifdebuggernotattached(a1, a2, a3);
  if ( ++dword_5081E4 == 600 )
  {
    ProgressiveDecompress_24(a4, a5);
  }
  else
  {
    ModuleHandleA = GetModuleHandleA("DECO_24.DLL");
    v6 = 6298;
    v7 = ModuleHandleA + 1024;
    v8 = 0;
    do
    {
      v8 += *v7;
      v7 = (_DWORD *)((char *)v7 + 1);
      --v6;
    }
    while ( v6 );
    __writefsdword(0, 0);
  }
}

// in WinMain:
debugthing = sub_479930(0, (int)v4, (int)v5);
if ( !debugthing )
    dword_5081E0 = SetTimer(0, 0, 1000u, (TIMERPROC)TimerFunc);
```

The `SetTimer` call basically sets up a timer that periodically (1000ms = 1 second) executes a function. Anyways, we're looking for any xref that uses this global in any meaningful way.

## Fail #2
Can you see that `debugthing`? Amazing name, I know. I wanted to know where it's used, mostly out of curiosity, and was able to trace it up until the very same function that handles the upgrade base / subtract rocks logic:

```x86asm
.text:004386A3 | mov     eax, [ebp+0Ch]    ; debugthing ends up here
.text:004386A6 | test    eax, eax
.text:004386A8 | jnz     short loc_4386B7
```

For some reason, it's always 0 (the return value of the SEH function) and at this point I was already severely sleep deprived, so I didn't want to bother with understanding what was going on there. Instead, I thought: "What if we can just patch that memory, at a specific point in time (after the value would have been set by the program itself), without patching anything in the binary?". In theory, this would allow us to bypass any integrity check as we would not rely on any code patches. I quickly implemented this idea using a [Vectored Exception Handler (VEH)](https://learn.microsoft.com/en-us/windows/win32/debug/vectored-exception-handling). My idea was that, since the game keeps causing software breakpoints anyways, I can just install a VEH that writes to `debugthing` after it has been triggered a few times:

```c
// We don't need this since we now hook DECO_24.DLL
LONG CALLBACK VectoredHandler(EXCEPTION_POINTERS* ExceptionInfo)
{
  static int hitCounter = 0;

  // This exception address occurs anyways, let's just reuse it
  if (ExceptionInfo->ExceptionRecord->ExceptionAddress == (PVOID)0x0047983A && hitCounter > 5 && hitCounter != 0xFF)
  {
    // Write "LAYL" to the flag, anything non-zero works
    BYTE* pLol = reinterpret_cast<BYTE*>(0x0076D160);
    pLol[0] = 'L';
    pLol[1] = 'A';
    pLol[2] = 'Y';
    pLol[3] = 'L';

    hitCounter = 0xFF; // Oracle to not trigger this again

    std::cout << "Patched upgrade base flag" << std::endl;
  }
  else if (ExceptionInfo->ExceptionRecord->ExceptionAddress == (PVOID)0x0047983A && hitCounter != 0xFF)
  {
    std::cout << "Hit exception " << std::hex << ExceptionInfo->ExceptionRecord->ExceptionAddress << " [" << hitCounter << "]. Waiting..." << std::endl;
    hitCounter++;
  }

  // There should be another handler available
  return EXCEPTION_CONTINUE_SEARCH;
}

AddVectoredExceptionHandler(1, VectoredHandler);
```

With the CD key placed in `C:\Data\cd.key`, no debugger attached, and the VEH installed to overwrite `debugthing`/`0x0076D160`, the game stopped crashing when we tried to upgrade the characters (I technically also removed all of the patches for the checksum checks)! I can't attach a video of it sadly as it takes quite a while for characters to be upgraded. 

However, the story doesn't end here. I passed the crack on again for some testing and...

![alt text](/images/lrr-ru/lastcrash.png)

## Circling Back
I took a step back and had a proper look at `sub_438699`:

```c
int __usercall sub_438699@<eax>(int a1@<eax>, int a2@<ebp>)
{
  // ... locals omitted ...

  *(_DWORD *)(a2 - 8) = a1;
  cdkeydriveletter = 0;
  result = *(_DWORD *)(a2 + 12);
  if ( result || *(_DWORD *)(a2 - 8) == 0x41321B )
  {
    ModuleHandleA = GetModuleHandleA("DECO_24.DLL");
    v5 = 6298;
  // ... omitted ...
```

It has a reference to `cdkeydriveletter`, which we've seen before, but it sets it to 0. What's going on here? Definitely suspicious, so let's dive into the disassembly again:

![](/images/lrr-ru/cdkeydriveletter.png)

We're currently located in the bottom half of the screenshot, notice however, how `sub_438699` is referenced in the upper half? We've encountered this before, where the next function would be pushed to the stack to jump to it once it hits the `ret`. This example is a bit different though, we now have a chain of `push` instructions as seen in box 1. The call chain can be defined as:

1. `ProgressiveDecompress_24` - we'll talk about this later
2. `sub_438699` - the function (or continuation of the upper half) that contains that weird `if` check

Let's talk about the other 2 boxes:
1. Box 2: The return value (in `EAX`) of `ProgressiveDecompress_24` is stored in `[ebp-8]`
2. Box 3: The stored value is compared to `0x41321B`

So whatever `ProgressiveDecompress_24` returns is compared to `0x41321B`. But... what is `ProgressiveDecompress_24`? Given the call chain mentioned earlier and considering the `stdcall` calling convention, we can abstract the callchain to something like this, so we definitely have to figure out what `ProgressiveDecompress_24` is:

```c
// mov edx, 2
// push edx
// xor eax, eax
// mov al, cdkeydriveletter
// push eax
DWORD value = ProgressiveDecompress_24(cdkeydriveletter, 2);
// return to sub_438699
if (value == 0x41321B) {
    // upgrade base, etc.
}
```

`ProgressiveDecompress_24` is located inside of `DECO_24.DLL`, a DLL that can only be found in Russian versions of Lego games. At this point it started to dawn on me... All the bugs we have encountered, the crashes and the gated functionality (upgrade base for example) are all DRM checks and not "just bugs/quirks". It reminded me a bit of that one Spyro game that would just delete your savegame towards the end(?) of the game. Are they just using "normal" sounding names to obscure what they're doing, kind of like what the Windows kernel does with PatchGuard? Let's look at the function in IDA:

```c
DWORD __stdcall ProgressiveDecompress_24(CHAR driveletter, __int16 idk)
{
  signed int Version; // eax
  __int16 v3; // cx

  Version = GetVersion();
  LOBYTE(v3) = driveletter;
  if ( Version >= 0 )
    return docdcheck(driveletter, idk);
  else
    return sub_10001353(v3, idk);
}

DWORD __cdecl docdcheck(CHAR driveletter, unsigned __int16 idk)
{
  __int16 v2; // si
  char nullbyte; // cl
  HANDLE FileA; // edi
  DWORD v5; // edx
  __int16 v6; // ax
  DWORD BytesReturned; // [esp+8h] [ebp-330h] BYREF
  CHAR FileName[8]; // [esp+Ch] [ebp-32Ch] BYREF
  CDROM_TOC OutBuffer; // [esp+14h] [ebp-324h] BYREF

  // f_drive = \\.\F:
  v2 = *(_WORD *)&f_drive[4];
  nullbyte = f_drive[6];
  *(_DWORD *)FileName = *(_DWORD *)f_drive;
  FileName[5] = HIBYTE(v2);
  FileName[6] = nullbyte;
  FileName[4] = driveletter;
  // FileName = \\.\C: in our case
  FileA = CreateFileA(FileName, 0x80000000, 3u, 0, 3u, 0x80u, 0);
  BytesReturned = 0;
  if ( FileA != (HANDLE)-1 )
  {
    // Grab table of contents from CD
    DeviceIoControl(FileA, IOCTL_CDROM_READ_TOC, 0, 0, &OutBuffer, 0x324u, &BytesReturned, 0);
    BytesReturned = 0;
    if ( OutBuffer.LastTrack >= (unsigned int)idk )
    {
      BytesReturned = *(_DWORD *)&OutBuffer.Length[8 * idk]; // Access something inside of track data?
      v5 = HIWORD(BytesReturned);
      BYTE1(v5) = BytesReturned;
      LOBYTE(v6) = HIBYTE(BytesReturned);
      HIBYTE(v6) = BYTE2(BytesReturned);
      LOBYTE(v5) = BYTE1(BytesReturned);
      v5 <<= 16;
      LOWORD(v5) = v6;
      BytesReturned = v5;
    }
    CloseHandle(FileA);
  }
  return BytesReturned;
}
```

`docdcheck` is the interesting function here, and all it does is grab a handle to the CD drive (remember `driveletter` comes from `cdkeydriveletter`, refer to the callchain earlier. In our case it "happens" to be `C:\` since that's where it found the `cd.key` file), and send a `IOCTL_CDROM_READ_TOC` IOCTL request to the disk driver. As per [MSDN](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddcdrm/ni-ntddcdrm-ioctl_cdrom_read_toc), `IOCTL_CDROM_READ_TOC` gets the table of contents for the given CD. The second argument `idk` is then used to offset into the `CDROM_TOC` structure which likely reads track data.

Could this function be responsible for my crashes? Since we're already using `MinHook` to hook Windows APIs, we might as well just give it a shot with the `ProgressiveDecompress_24` function since we know what we're expected to return (`0x41321B`, refer to the start of this chapter).

```c
using ProgressiveDecompress_t = DWORD(__stdcall*)(CHAR driveletter, __int16 value);

ProgressiveDecompress_t* g_OriginalProgressiveDecompress = nullptr;

DWORD __stdcall ProgressiveDecompress_hk(CHAR driveletter, __int16 value)
{
    DWORD result = 0;

    switch (value)
    {
    case 2:
        result = 0x0041321B; // This is the one we observed this chapter
        break;
    default:
        result = (DWORD)"LAYL";
        break;
    }

    std::cout << "ProgressiveDecompress(\'" << driveletter << "\', " << value << ") -> " << std::hex << result << std::endl;

    return result;
}

if (MH_CreateHookApi(
    L"DECO_24.dll",
    "ProgressiveDecompress_24",
    ProgressiveDecompress_hk,
    reinterpret_cast<LPVOID*>(&g_OriginalProgressiveDecompress)
) != MH_OK)
    std::cout << "Failed to create hook for ProgressiveDecompress" << std::endl;
```

With the debugger attached, the VEH meme removed, and the checksum patches reapplied... we crash again, fast :')

## Fighting the DRM - Part 2
I used the same approach as earlier to create memory read breakpoints in the debugger, but placed it on `ProgressiveDecompress_24` this time. That immediately revealed more integrity/checksum checks:

```x86asm
004386DF | 0306 | add eax,dword ptr ds:[esi]
004798CA | 0306 | add eax,dword ptr ds:[esi]
```

Let's have a look at the last one:

![](/images/lrr-ru/deco24integrity.png)

It's the exact same logic as the one mentioned before, except this time it iterates over the module `DECO_24.DLL` and not `LegoRR.exe`. So why did our pattern not catch it? Since it's a different module, the known key which is subtracted from the checksum must be different. The pattern I extracted initially was the last part of this sequence, the one holding the key. Instead, I grabbed the loop's byte sequence (`03 06 46 49 75 FA`) and scanned for that instead, which revealed the aforementioned 2 new locations (along with the previous, already known 3 locations). I appended the following code to the existing patches:

```c++
NopChecksumCheck(reinterpret_cast<BYTE*>(0x004386F1), 3); // DECO_24.dll Checksum 1
std::cout << "Patched checksum check (DECO_24.DLL Checksum 1)" << std::endl;

NopChecksumCheck(reinterpret_cast<BYTE*>(0x004798DC), 3); // DECO_24.dll Checksum 2
std::cout << "Patched checksum check (DECO_24.DLL Checksum 2)" << std::endl;
```

No crashes on startup, which means we successfully bypassed the integrity checks for `DECO_24.DLL` as well! An added bonus at this point is that the game doesn't require the `cd.key` anymore. `ProgressiveDecompress_24` was the only location where the drive letter actually mattered, and since we're not relying on it at all in our hook, it won't matter whether the `cdkeydriveletter` was set or not.

## Finishing Move
So far we have 3 things:
1. 2 hooks for `GetDriveTypeA` and `GetVolumeInformationA` hooks to bypass the initial CD checks
2. 1 hook for `ProgressiveDecompress_24` to prevent CD access failure and return the required values for normal execution
3. 5 patches to render the checksum checks useless (3 for `LegorRR.exe`, 2 for `DECO_24.DLL`)

This time I ran the tests myself as you can unlock all levels using the argument `-testlevels`, and the last known crash (not the integrity one, the gameplay one that would trigger randomly after a while) would just involve idling around for a few minutes. I crashed again, but in my console window I was greeted with a new log line:

![](/images/lrr-ru/decompresslog.png)

The line `ProgressiveDecompress(' ', 3) -> 7257e998` is very interesting (side note, notice the ' ', that's because we removed the `cd.key` yet it still works) as it shows that the 2nd argument can be `3` as well. `7257e998` is basically my default case in the code that sets `result = (DWORD)"LAYL";`. Since we're covering only `case 2`, a bogus value is returned. Xrefing `ProgressiveDecompress_24` shows a caller that pushes `3` to the stack as argument and requires the function to return `0x0043002F`.

![](/images/lrr-ru/lastdecompresscall.png)

At this point I updated the hook like this and ran a test again!

```c
DWORD __stdcall ProgressiveDecompress_hk(CHAR driveletter, __int16 value)
{
    // value == 2 => 004386AA | 817D F8 1B324100 | cmp dword ptr ss:[ebp-8],legorr.41321B
    // value == 3 => .text:00479893                cmp     [ebp+var_4], 43002Fh

    DWORD result = 0;

    switch (value)
    {
    case 2:
        result = 0x0041321B;
        break;
    case 3:
        result = 0x0043002F;
        break;
    default:
        result = (DWORD)"LAYL"; // Should never happen, at least not for LRR
        break;
    }

    std::cout << "ProgressiveDecompress(\'" << driveletter << "\', " << value << ") -> " << std::hex << result << std::endl;

    return result;
}
```

I let the game run, played for about 30 minutes (it would usually crash within the first 10 minutes), and my friend even completed a level (which took more than an hour) and none of us had crashes! At this point, we're very confident that I managed to identify and tackle all DRM checks and restore the game to its original functionality - even without a CD mounted.

![](/images/lrr-ru/playthrough.png)

You can find all of the code (incl. the original attempts in either the comments or commit history) on my [GitHub](https://github.com/ioncodes/LRR_RU_NOCD). The release section also contains the latest DLLs that can simply be dropped into the installation folder. These patches will ship with the official installers distributed over at [The Research Realm website](https://lrr.researchrealm.net/).

## The End
This marks a huge milestone as a public No-CD crack was not available for this rare Lego version, and neither does any documentation on how the DRM works. To this day, only people with legitimate copies of the game were able to run the game, and these copies of the Russian version are extremely hard to come by.  

During the research, we noticed that some other Russian versions have the same DLLs. It's currently unknown to us whether there are actually more lost/unfixed games and media, and we're currently trying to get our hands on them along with test setups to see if they work on modern machines or whether they need fixes/cracks as well.

Huge thank you to The Research Realm for trying to preserve a very important part of history! It's very sad to think that one day, these games might just be completely lost, and it's therefore very important to back everything up as early as possible and make compatibility patches. The Research Realm is currently led by the founder [Klavvy/baraklava](https://www.youtube.com/@Klavvy) of [Manic Miners](https://manicminers.baraklava.com/), a modern remake of Lego Rock Raiders and a current employee at The Lego Group. Lego endorses the project as long as there is no financial incentive (e.g. donations, etc).