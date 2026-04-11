# Reravel

```
                                                                           
                      @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@                      
                @@@@@@@@@+++++=-------------=+++++@@@@@@@@@                
            @@@@@#=-------------------------------------=#@@@@@            
         @@@@=---------------------%%%%%---------------------=@@@@         
        @@*--------------------=@@@@@@@@@@@+--------------------*@@        
       @@+--------------------*@@*+++++++*@@*--------------------=@@       
       @@*--------------------+@@#+++++++#@@+--------------------+@@       
        @@#--------------------=%@@@@@@@@@@=--------------------#@@        
         @@@@*+--------------------*****--------------------+*@@@@         
            @@@@@%*=------------------------------------*%@@@@@            
                @@@@@@@@@#####+-------------+#####@@@@@@@@@                
                    @@====@@@@@@@@@@@@@@@@@@@@@@@*+++%@@                   
                    @@=--------------=+++++++++++++++%@@                   
                    @@=------=+++++++=--------+++++++%@@                   
                    @@+====+++++++++++========-------#@@                   
                    @@=----=======++++++++++++++*****%@@                   
                    @@=------======---========+++++++%@@                   
                    @@=======++++++++================#@@                   
                    @@+======+++++++++++++++++=------#@@                   
                    @@=------++++++++++++++++++++++++%@@                   
                    @@=--------------=+++++++++++++++%@@                   
                    @@=------=+++++++=--------+++++++%@@                   
                @@@@@@++++++++++++++++++++++++=------#@@@@@                
            @@@@@%#*@@=-----=+++++++++++++++++=======%@%#%@@@@@            
         @@@@##+++++@@=------=========+++++++++++++++%@%++++*#@@@@         
        @@%+++++++++@@=------=================+++++++%@%++++++++%@@        
       @@#++++++++++@@+++++++++++++++=---------------#@%+++++++++#@@       
       @@*++++++++++++++++++++++++++++++++++++++++++++=++++++++++*@@       
        @@#+++++++++++++++++++++++++++++++++++++++++++++++++++++#@@        
         @@@@+++++++++++++++++++++++++++++++++++++++++++++++++@@@@         
            @@@@@%*+++++++++++++++++++++++++++++++++++++*#@@@@@            
                @@@@@@@@@******++++++++++++++*****@@@@@@@@@                
                      @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@                      
                                                                           
```

A Chrome extension that makes social media boring on purpose.

Reravel applies visual and behavioral friction to sites you choose: grayscale, reduced contrast, dimmed opacity, a vignette overlay, and typography flattening. When you navigate to a monitored site, you hit a pause screen with a random quote before you can scroll. The goal isn't to block anything. It's to make the experience just unpleasant enough that you stop and ask yourself if this is what you actually want to be doing.

<!-- TODO: add GIF here showing the interstitial + filter in action -->

## What it does

- **Degrades the visual experience** with layered CSS filters (grayscale, contrast, opacity, vignette) that make sites feel flat and lifeless
- **Interrupts auto-pilot browsing** with a timed interstitial showing a rotating quote from Seneca, Marcus Aurelius, Cal Newport, and others
- **Flattens typography** by optionally overriding fonts to monospace, removing bold text, and tightening line spacing
- **Bizarro mode** for when grayscale isn't enough: inverted colors, hue-rotated, over-saturated
- **Snooze** for 1 or 5 minutes when you actually need to use a site
- **Keyboard shortcut** (Alt+Shift+G) to toggle without opening the popup

Every effect has its own slider. The site list is fully configurable.

## Install

1. Clone this repo
2. Go to `chrome://extensions` and enable Developer Mode
3. Click "Load unpacked" and select the repo directory

No build step. No dependencies.

## How it works

Reravel injects a `<style>` tag into monitored sites at `document_start`, before the page renders. All visual effects are pure CSS, which means they work under strict Content Security Policies (Discord, etc.) and apply instantly with no flash of unstyled content.

The interstitial is a full-screen overlay that blocks the page for a configurable number of seconds (default 12). It shows a random quote and your custom message, then fades away. It fires once per page load, so refreshing triggers it again.

SPA navigation is handled for YouTube (`yt-navigate-finish` event) and Discord (`#app-mount` polling).

## Stack

- Chrome Extension Manifest V3
- Vanilla JS, CSS
- `chrome.storage.sync` for settings, `chrome.storage.local` for ephemeral state
- `chrome.scripting.registerContentScripts` for dynamic site targeting
- `chrome.alarms` for snooze timers

## Why

Social media sites are designed by very smart people to be as visually engaging as possible. Color, typography, layout, and motion are all tuned to keep you scrolling. Reravel turns those dials in the other direction. It doesn't block you from going to Reddit. It just makes Reddit feel like a government website from 2004.

The interstitial adds a second layer of friction: a forced pause that gives your prefrontal cortex a chance to catch up with the habit loop your basal ganglia already started.

## License

MIT
