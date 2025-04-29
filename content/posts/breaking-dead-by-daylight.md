---
author: "Layle"
slug: "breaking-dead-by-daylight"
aliases: ["/breaking-dead-by-daylight"]
title: "Breaking Dead by Daylight without Process Interaction"
summary: "Is it possible to cheat in a game without any process interaction? Let's find out."
tags: ["game-hacking", "reverse-engineering", "man-in-the-middle"]
date: 2020-04-14T22:00:00Z
weight: 2
draft: false
---


This article is a mirror of the previous release posted on the [secret club](https://web.archive.org/web/20200426100352/https://secret.club/2020/04/15/dead-by-daylight.html) blog.

For the past few months I’ve been looking into a game called Dead by Daylight which is protected by EasyAntiCheat. This game is unique in a special way and we’ll be exploring why. All these methods are already to be found on various types of forums and nothing is per se ground breaking. This is a guide about how I approached these things while shedding light into the inner workings of the actual cheats. **Do not use this to get an advantage in the game.**

## Introduction

What makes Dead by Daylight special? Dead by Daylight has a quite long record in terms of bugs and lazy coding. The game communicates with the game server using a REST API which is quite easy to reverse. As mentioned, the game is protected by EasyAntiCheat but in this case I tried to develop as many bypasses and cheats as possible _without_ interacting with the game process at all.

## Version 3.0.0

Version 3.0.0 is quite famous in the particular cheating scene. It was one of the last versions that had no SSL pinning embedded, therefore making it easy to reverse the API. However, currently version 3.6.2 is out meaning that version 3.0.0 is no longer available to download through the store. Luckily, this isn’t stopping us thanks to Steam’s depot system which allows us to download any version of the game as long as we know the game specific IDs which can be looked up on [SteamDB](https://steamdb.info/app/381210/depots/). To do this we have to run Steam with the “-console” flag and then enter `download_depot 381210 381211 9043651681125706667`. Unfortunately, this isn’t working in the latest versions of Steam, but no worries, I’ll explain why. It turns out that the manifest file for this version is not available anymore. Luckily, Steam doesn’t really care about it as long as we just invert the check :)

![](/images/dbd/steam-dbg.png)

You can find an automated patcher on [GitHub](https://github.com/ioncodes/SteamManifestFixer) which you can run while Steam is running. Once the files are downloaded we can copy them over to Dead by Daylights installation path and fire up a sniffer like mitmdump or Fiddler.

### Sniffing

There’s 2 request of particular interest. The first one is a POST request which sends the current game version to the server to check whether there’s any:

```http
POST https://latest.live.dbd.bhvronline.com/api/v1/auth/provider/steam/login?token=<token> HTTP/1.1
Host: latest.live.dbd.bhvronline.com
Accept: */*
Accept-Encoding: deflate, gzip
Content-Type: application/json
User-Agent: DeadByDaylight/++DeadByDaylight+Live-CL-134729 Windows/10.0.19587.1.256.64bit
Content-Length: 78

{"clientData":{"catalogId":"<ID>","consentId":"<ID>"}}

```

This is easily bypassed by intercepting the traffic and changing the JSON body with the latest version IDs:

```json
{"clientData":{"catalogId":"3.6.0_281460live","consentId":"3.6.0_281460live"}}

```

The response of this request contains a cookie called `bhvrSession` which we will need to further authenticate to the server.

One of the other important requests is the following GET request:

```http
GET https://latest.live.dbd.bhvronline.com/api/v1/utils/contentVersion/version HTTP/1.1
Host: latest.live.dbd.bhvronline.com
Accept: */*
Accept-Encoding: deflate, gzip
Content-Type: application/json
User-Agent: DeadByDaylight/++DeadByDaylight+Live-CL-134729 Windows/10.0.19587.1.256.64bit
Content-Length: 0

...

{"availableVersions":
{"3.3.0_240899live":"3.3.0_240899live-1572383573","3.3.0_241792live":"3.3.0_241792live-1572620532"
...

```

The request was stripped down to the most important part. The server returns all available versions that are allowed to log into the game server. This is easily bypassed by adding the identifiers for version 3.0.0 to the response body. Here’s a snippet from my script:

```python
response["availableVersions"]["3.0.0.13"] = "3.0.0.13-1561474922"
response["availableVersions"]["3.0.0.16"] = "3.0.0.16-1562079672"
response["availableVersions"]["3.0.0.4"] = "3.0.0.4-1560778720"

```

Unfortunately, Dead by Daylight introduced further checks based on locally generated tokens which are not present in this version of the game. This didn’t stop other cheaters to just embed the keys from the latest version into their own script and sending the values manually.

Of course I won’t let you sit around without knowing _how_ some of the cheats handle this which is why I reversed one of them:

```csharp
public static string DecryptSettings(string cryptedString)
{
    string result;
    using (DESCryptoServiceProvider descryptoServiceProvider = new DESCryptoServiceProvider())
    {
        using (MemoryStream memoryStream = new MemoryStream(Convert.FromBase64String(cryptedString)))
        {
            using (CryptoStream cryptoStream = new CryptoStream(memoryStream, descryptoServiceProvider.CreateDecryptor(Encoding.ASCII.GetBytes("Kowalski"), Encoding.ASCII.GetBytes("XSkipper")), CryptoStreamMode.Read))
            {
                using (StreamReader streamReader = new StreamReader(cryptoStream))
                {
                    result = streamReader.ReadToEnd();
                }
            }
        }
    }
    return result;
}

```

Yeah, that’s it. The keys are stored in `settings.cfg`. The last keys I had dumped from the cheat are:

```json
{
    "shortVersion": "gABAC7ps70O7AIQpTyDat2oXiesXt9MfXTwF4N+JuJ2bPtVLgUTNoScQqOCPG6t5YuQKkwfPeT6wT38PgeSZneZYeWtbfLVugRnnL/TbeS69utpJ6LXRYfX++4/AYQZ/6vurmRBop30Ss+QhizqLsZ0p7t3p7C6mAbULpI8MWkLu/NwmwgBKCg6Q6RzvjL+yUJWZNwZCOobiFwCLtla7yLjfXs93NJqny8UkFeIHbM4HOiUw19+aERrCvkYRgiOAfl7UVT3hISabVjj9I3XXOki+Ax45FT/mIygwrOwj3RpKPCx8a7/N4rEULj17etYFZWxAK6gi02gtgctP01G0Kg==",
    "longVersion": "fdNyatrP2l9g4EtW6S/FPsymfTGs6AjtgJi0vdLc3eCFLBBVd20gaTSC2JgKVsmx+r8sphoAraxWYT5hkMylKAlmC+7o2ZXILhLWSdOrFWqhs7gYlSXc/+6gaLOZ4fYC4m42hRLekInZL1ikIdzab6cvdbVdvmCNSWeaR9fXSRM+KKNFl9RagD5ZKOh2vFCDV1xquol2Wq+y5Q7LCBpqtvppQ59YimbtjZoaFHPVVIbaxFyhueelqe02IOOC4OWD9Kmtj7WmbGpekcMJRhdjz/NDmnJc1tmy4U5VvgnVwmC8o+plQtcLIFvpFKpKm6bkAnyiXCdy9puQe/X8S2kV6Q=="
}

```

Feel free to decrypt the newer versions and use his keys :) Anyways, we wont do that. Lets upgrade to 3.6.2 and do it like the cool kids.

## Version 3.6.2

Upgrade as usual, you can do that by invalidating the files in Steam. Reinstalling works fine too. As mentioned before, Dead by Daylight has introduced SSL pinning, so how do we do it? Let’s take a deep dive into reverse engineering the game itself.

### The true hero: Constants

First things first, we need as much information of the target binary as possible. One of the first things I like to do is checking for strings:

```shell
layle@pwn$ rabin2 -zzz DeadByDaylight-Win64-Shipping.exe | grep curl
1245065 0x04a4e368 0x144a4f568  37  38 (.rdata) ascii CLIENT libcurl 7.55.1-DEV\r\n%s\r\nQUIT\r\n
```

Now we know they use `libcurl` version 7.55.1, probably a debug build. Even better! Let’s check the official documentation on how SSL certificates are handled. You can find the specific page [here](https://curl.haxx.se/docs/sslcerts.html). Two constants are important: `CURLOPT_SSL_VERIFYHOST` and `CURLOPT_SSL_VERIFYPEER`. Let’s download the specific source code and open it up. Searching for those constants reveal an enum in `curl.h`:

```c
CINIT(SSL_VERIFYPEER, LONG, 64),
CINIT(SSL_VERIFYHOST, LONG, 81),

```

Now let’s navigate to `url.c` where `Curl_setopt` is defined. Here’s a short excerpt of the function:

```c
CURLcode Curl_setopt(struct Curl_easy *data, CURLoption option,
                     va_list param)
{
  char *argptr;
  CURLcode result = CURLE_OK;
  long arg;
#ifndef CURL_DISABLE_HTTP
  curl_off_t bigsize;
#endif

  switch(option) {
  case CURLOPT_DNS_CACHE_TIMEOUT:
    data->set.dns_cache_timeout = va_arg(param, long);
    break;
  case CURLOPT_DNS_USE_GLOBAL_CACHE:
    /* remember we want this enabled */
    arg = va_arg(param, long);
    data->set.global_dns_cache = (0 != arg) ? TRUE : FALSE;
    break;
  case CURLOPT_SSL_CIPHER_LIST:
// ...
   if(strcasecompare(argptr, "ALL")) {
      /* clear all cookies */
      Curl_share_lock(data, CURL_LOCK_DATA_COOKIE, CURL_LOCK_ACCESS_SINGLE);
      Curl_cookie_clearall(data->cookies);
      Curl_share_unlock(data, CURL_LOCK_DATA_COOKIE);
    }
    else if(strcasecompare(argptr, "SESS")) {
      /* clear session cookies */
      Curl_share_lock(data, CURL_LOCK_DATA_COOKIE, CURL_LOCK_ACCESS_SINGLE);
      Curl_cookie_clearsess(data->cookies);
      Curl_share_unlock(data, CURL_LOCK_DATA_COOKIE);
    }
    else if(strcasecompare(argptr, "FLUSH")) {
      /* flush cookies to file, takes care of the locking */
      Curl_flush_cookies(data, 0);
    }
    else if(strcasecompare(argptr, "RELOAD")) {
      /* reload cookies from file */
      Curl_cookie_loadfiles(data);
      break;
    }

```

The possibilities are endless. We have a lot of inlined constants and a lot of string references at our disposal to find the function in memory. The function starts with the following assembly:

```x86asm
mov qword ptr ss:[rsp+8],rbx
mov qword ptr ss:[rsp+10],rbp
mov qword ptr ss:[rsp+18],rsi
push rdi
sub rsp,30
xor ebp,ebp
mov rsi,r8
mov rbx,rcx
cmp edx,D2

```

As we can see the register `edx` will contain the constant. Depending on what value is set it will branch to different code to apply the options passed to the function. We are primarily looking for the constants `0x40` and `0x51`. As we know from the original source code, the third argument contains the value, in this case it will be either `true` or `false`. The third register is `r8` and contains a pointer to the memory holding the flag. We can use x64dbg’s conditional breakpoints to automatically patch memory on trigger:

![](/images/dbd/xdbg-cond-bp.png)

In the following image you can see that `edx` is set to `0x40` and that register `r8` points to our patched value in memory.

![](/images/dbd/process-xdbg.png)

You may be wondering: “But we are touching the process?”. That’s right, we are and that’s why I’m gonna stop here :) I’m currently working on an usermode emulator for EasyAntiCheat (which I’ve been using in the above screenshot), we will cover more about the debugging features in that article.

### Experiments

Looking back, I wish I had tried doing this before. Looking at Dead by Daylight’s track record it’s quite obvious that they must have messed up something trivial even in the latest version. The game uses Unreal Engine 4. All game assets are stored in so called “pak” files. Checking the strings of these files already reveals a whole lot of other information. Would you believe me if I told you Dead by Daylight doesn’t do any integrity checks on the “pak” files? Right. There’s 2 ways to approach this, either we give [QuickBMS](https://aluigi.altervista.org/quickbms.htm) a shot or we use a hex editor. In this article we will be using the hex editor approach, doing it with QuickBMS is left as an exercise to the reader. The advantage would be that you can patch _all_ configuration files and assets in the game, allowing you to get really close to a full wallhack. The file we will be editing is called `pakchunk0-WindowsNoEditor.pak` and hosts the main configuration files that are relevant for cheating purposes. Look for `SSL` and just erase the content to null bytes.

![](/images/dbd/ssl-hex.png)

Here’s a dump of all the pinned keys that are being used:

```
+PinnedPublicKeys=".dev.bhvrdbd.com:++MBgDH5WGvL9Bcn5Be30cRcL0f5O+NyoXuWtQdX1aI=;PiEjPYP2N0QUoKvrwZZjmvSLIl0bBGJgKUevOeNowEM="
+PinnedPublicKeys=".qa.bhvrdbd.com:++MBgDH5WGvL9Bcn5Be30cRcL0f5O+NyoXuWtQdX1aI=;tBLmAw0lCqG3/5sn6ooVk9JNdIcptJb0iXoi4qkAqUo="
+PinnedPublicKeys=".stage.bhvrdbd.com:++MBgDH5WGvL9Bcn5Be30cRcL0f5O+NyoXuWtQdX1aI=;OBU5+MqEy/LV95MgQf23LGpAaaYElBvALjPW7AgmMNo="
+PinnedPublicKeys=".ptb.bhvrdbd.com:++MBgDH5WGvL9Bcn5Be30cRcL0f5O+NyoXuWtQdX1aI=;ICaQHYr/VHjpTY6UKcm8FUtWnUMe9q6WNrzr+WDuUls="
+PinnedPublicKeys=".cert.bhvrdbd.com:++MBgDH5WGvL9Bcn5Be30cRcL0f5O+NyoXuWtQdX1aI=;pvf7WXymw2xK8n6YTqblRrt3vwe2mSuGmAk8buiF2C4="
+PinnedPublicKeys=".management.live.bhvrdbd.com:++MBgDH5WGvL9Bcn5Be30cRcL0f5O+NyoXuWtQdX1aI=;EXrEe/XXp1o4/nVmcqCaG/BSgVR3OzhVUG8/X4kRCCU="
+PinnedPublicKeys="steam.live.bhvrdbd.com:++MBgDH5WGvL9Bcn5Be30cRcL0f5O+NyoXuWtQdX1aI=;EXrEe/XXp1o4/nVmcqCaG/BSgVR3OzhVUG8/X4kRCCU="

```

Anyways, save the file, open up your proxy (in my case mitmweb) and run the game!

### Sniff’n’Decrypt

At this stage you should be able to see the requests. As you can see there’s also a new request to the endpoint `clientVersion/check`. Remember the keys I mentioned earlier? Those keys are sent to this endpoint, verifying our `bhvrSession` to be allowed to send further requests to the game server. However, we don’t have to worry about them anymore since the game does that for us without an issue.

![](/images/dbd/endpoints.png)

Eventually we will end up with a request to `FullProfile/binary` at this stage it’s a GET request which fetches the profile data of the current player.

```http
GET https://latest.live.dbd.bhvronline.com/api/v1/players/me/states/FullProfile/binary HTTP/1.1
...

DbdDAgAC0Yh1kjiaxVnUM1aTDgjahR1BTCe3iiAWGiwQk+4OCPnSOU6mzbfid9Ag6883sQKbf6G9jRiYUD9DQUmA4TmT6yPBznJEcxhzvp+W/QhcgXhPLsD6o8CWt1iMcV8uStjBH3W6r+Bk0COJ5SSSOdKNU8

```

This data contains the inventory, which is particularly interesting to cheat items. A very similar endpoint is used using a POST request which uploads the inventory. It is possible to decrypt the inventory, edit it, encrypt it and then send this to the server. This allows us to get whatever items we want, with whatever perks we want. To make things crystal clear, here’s how they decrypt the profile:

```python
cipher  = AES.new(b"5BCC2D6A95D4DF04A005504E59A9B36E", AES.MODE_ECB)
profile = flow.response.content.decode()[8:]
profile = base64.b64decode(profile)
profile = cipher.decrypt(profile)
profile = "".join([chr(c + 1) for c in profile])
profile = base64.b64decode(profile[8:])
profile = profile[4:len(profile)]
profile = zlib.decompress(profile).decode("utf16")
profile = json.loads(profile)

```

Encryption works the same way, just in reverse. This is also left as an exercise for the reader.

### RTM

There’s also another request sent to and endpoint named `/getUrl` which provides you with a URL to a websocket endpoint. There’s a lot of information flowing through, some of it is in the game state :) Unfortunately, only one client can be connected at a time, doesn’t stop you from proxying the websocket connection though. This is out of scope and is only mentioned as information, we will be doing this in an even funnier way. Nonetheless, sample code is provided [here](https://github.com/ioncodes/DeadByDaylight/blob/master/dbd_injector/rtm.py).

### Predicting killers

Recently some posts emerged of people polling the Dead by Daylight logfile to figure out the killer while being in the lobby. That’s all fun and stuff, but code like this just shouldn’t be written at all. Especially not if the author claims it to be for “learning purpose”:

```python
yourId2 = (str(x2[len(x2) - 2].split('\n[')[0]))[46:]
yourId3 = (str(x2[len(x2) - 3].split('\n[')[0]))[46:]
yourId4 = (str(x2[len(x2) - 4].split('\n[')[0]))[46:]
yourId5 = (str(x2[len(x2) - 5].split('\n[')[0]))[46:]
verifyKiller2 = (((((str(x2[len(x2) - 2].split('GameFlow: Verbose:')[0]))[509:]).split('\n'))[0]).split('_'))[0]
verifyKiller3 = (((((str(x2[len(x2) - 3].split('GameFlow: Verbose:')[0]))[509:]).split('\n'))[0]).split('_'))[0]
verifyKiller4 = (((((str(x2[len(x2) - 4].split('GameFlow: Verbose:')[0]))[509:]).split('\n'))[0]).split('_'))[0]
verifyKiller5 = (((((str(x2[len(x2) - 5].split('GameFlow: Verbose:')[0]))[509:]).split('\n'))[0]).split('_'))[0]

```

Let’s do it the right way. From our debugging session earlier you might have noticed that the game prints strings to the “Log” tab in x64dbg. This is because Windows redirects all debug strings that end up in `DbgPrint` to the debugger if one is attached. However, it’s actually possible to access these strings without a debugger and I’ve just recently reversed how to do so from DebugView. You can find the reversed project [on my personal GitHub](https://github.com/ioncodes/dbgmon). The basic idea is to access Windows' message buffer (`DBWIN_BUFFER`) and wait for certain events (`DBWIN_BUFFER_READY` and `DBWIN_DATA_READY`). This allows us to interact with the games logs in realtime without having to poll any text files and accidentally filter out old information which isn’t relevant. Utilizing very basic Regular Expressions we are able to determine the killer (even if he changes the character while being in the lobby which the original script can’t do!) and also his Steam profile. The options are endless! Here’s a broken down version of what is actually going on:

```cpp
const auto process_id = find_process("DeadByDaylight-Win64-Shipping.exe");

const std::regex character_id_pattern("Spawn new pawn characterId (\\d+)\\.");
const std::regex steam_id_pattern("Session:GameSession PlayerId:([0-9\\-a-z]+)\\|(\\d+)");
const std::regex killer_pattern("MatchMembersA=\\[\\\"([a-z0-9\\-]+)\\\"\\]");
auto buffer_ready = open_event(
    EVENT_ALL_ACCESS,
    L"DBWIN_BUFFER_READY");
auto data_ready = open_event(
    SYNCHRONIZE,
    L"DBWIN_DATA_READY");
auto file = open_mapping(
    L"DBWIN_BUFFER");
auto buffer = reinterpret_cast<message*>(
    wrapper::map_view_of_file(
        file,
        SECTION_MAP_READ,
        0, 0, 0));

std::string killer_id;

while (wrapper::wait_for_single_object(
    data_ready,
    INFINITE) == WAIT_OBJECT_0)
{
    if (buffer->process_id == process_id)
    {
        auto message = std::string(buffer->data);
        std::smatch matches;

        if (std::regex_search(message, matches, character_id_pattern))
        {
            auto character_id = std::stoi(matches[1].str());
            auto killer = KILLERS.find(character_id);
            if (killer != KILLERS.end())
            {
                std::cout << "Killer: " << killer->second << std::endl;
            }
        }
        else if (std::regex_search(message, matches, steam_id_pattern))
        {
            auto player_id = matches[1].str();
            auto steam_id = matches[2].str();
            if (player_id == killer_id)
            {
                std::cout << "Killer Steam Profile: https://steamcommunity.com/profiles/" << steam_id << std::endl;
            }
        }
        else if (std::regex_search(message, matches, killer_pattern))
        {
            killer_id = matches[1].str();
            std::cout << "Found Killer PlayerID: " << killer_id << std::endl;
        }
    }

    wrapper::set_event(buffer_ready);
}

wrapper::unmap_view_of_file(buffer);
wrapper::close_handle(file);
wrapper::close_handle(buffer_ready);
wrapper::close_handle(data_ready);

```

This code is just for demonstration purposes, you can find the project [here](https://github.com/ioncodes/DeadByDaylight).

![](/images/dbd/killer-predict.png)

### Ranking up

During my research I created a script ([authenticator.py](https://github.com/ioncodes/DeadByDaylight/blob/master/dbd_injector/authenticator.py)) that automates information dumping (such as `bhvrSession`) and also decrypts the inventory. The data is being written in separate JSON files. Once the files are created you are free to run the scripts [levelup.py](https://github.com/ioncodes/DeadByDaylight/blob/master/dbd_injector/levelup.py) and [rankup.py](https://github.com/ioncodes/DeadByDaylight/blob/master/dbd_injector/rankup.py). The scripts send basic POST requests to the endpoints `/api/v1/ranks/pips` and `/api/v1/extensions/playerLevels/earnPlayerXp` respectively. The needed JSON bodies are as follows (in the same order as above):

```json
{
    "data": {
        "consecutiveMatch": 1,
        "emblemQualities": [
            "Iridescent",
            "Iridescent",
            "Iridescent",
            "Iridescent"
        ],
        "isFirstMatch": true,
        "levelVersion": 1337,
        "matchTime": 1000,
        "platformVersion": "steam",
        "playerType": "survivor"
    }
}

```

```json
{
    "forceReset": true,
    "killerPips": 2,
    "survivorPips": 2
}

```

## Final words

To wrap things up I would like to say that there’s way more to explore and the code published can be improved in a lot of ways. I believe the most important take away is that debug events/strings can be really dangerous if used excessively. I believe that the general approaches and efforts from Behaviour are fine. However, some details still have room for improvement such as fixing their anticheat to check all game files. One more important note that I haven’t mentioned is the fact the pak files do not use an encryption key. Unreal Engine 4 has a feature to encrypt all game files with a specific key. Of course this can be reverse engineered but it makes creating cheats harder nonetheless. If there’s any open questions or feedback feel free to reach out to me on [Twitter](https://twitter.com/layle_ctf).

