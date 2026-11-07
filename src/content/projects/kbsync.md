---
title: kbsync
order: 3
category: macOS tools
blurb: Keeps a MacBook's keyboard backlight in step with its screen brightness. Event-driven Swift with no dependencies, using no CPU while idle.
summary: Dim your screen in a dark room and the keyboard stays blinding. kbsync fixes that. It's a menu bar app and a command-line tool in Swift that reacts to every brightness change in about 7 ms and uses no CPU the rest of the time.
pill: 7 ms reaction, 0 idle wakeups
repo: https://github.com/simar-s2/kbsync
stack: [Swift, macOS, launchd, Homebrew]
results:
  - label: Reaction time
    value: 7 ms
    note: From the screen changing to the keyboard following, on an M1 Pro running macOS 26.6.
  - label: Wakeups while idle
    value: '0'
    note: 0.0% CPU for both the app and the command-line tool. It doesn't poll.
  - label: Memory
    value: 4.6 MB
    note: For the command-line tool. The menu bar app uses about 13 MB.
  - label: Leaks
    value: 0 bytes
    note: Memory was unchanged after a stress test of 20,000 brightness changes.
problem:
  - On Apple Silicon MacBooks, the screen and the keyboard backlight are separate. Turn the screen down at night and the keyboard stays bright unless you change it too.
  - macOS has no public API for either brightness. The obvious way to do this, polling, would have to run ten or more times a second to feel instant, all to watch a value that changes a few times an hour. I wanted something that costs nothing until the brightness actually moves.
pipeline:
  - name: Change
    note: keys, Control Center, auto-brightness
  - name: Notify
    note: DisplayServices wakes the process
  - name: Merge
    note: a burst becomes one handler call
  - name: Curve
    note: min + (max − min) × screen^gamma
  - name: Fade
    note: CoreBrightness sets the keyboard
---

kbsync loads two private frameworks at runtime with `dlopen`. DisplayServices has a system-wide notification, so one process hears about it when any other process changes the brightness. CoreBrightness sets the keyboard level through the same API the Control Center slider uses.

It doesn't matter how the screen changes: brightness keys, Control Center, auto-brightness or another app all send the same notification. kbsync runs the new level through a curve the user can shape with `--min`, `--max` and `--gamma`, then fades the keyboard to match.

While it runs, kbsync turns off "Adjust keyboard brightness in low light" so the light sensor doesn't fight it, and turns the setting back on when it stops. The display's own auto-brightness is untouched, so the keyboard still follows the room, through the display.

The same core powers a menu bar app and a command-line tool with a launch agent. The curve, argument parsing and sync rules live in `KBSyncCore`, which has no idea what hardware it's running on.

## Decisions

- **Notifications, not polling.** The process sleeps until macOS has something to say, which is why it shows 0 wakeups while idle.
- **Merge bursts with a GCD data-add source.** A held key or a dragged slider can send hundreds of notifications a second. Each one bumps the source, which merges any burst into one handler call. Before that, a 5,000-change burst queued about 2,500 callbacks. Now it queues a handful.
- **Check every private selector first.** Each one goes through `responds(to:)`, so a macOS update that changes the API gives a clear error instead of a crash.
- **Fake hardware for the tests.** The core is unit tested against a fake display and keyboard. The private-framework bridges were tested on the real machine, down to the PWM register.
- **The repo is its own Homebrew tap.** One `brew tap` and one `brew install`, with no second repo to keep in sync.

## What I found in the private APIs

- **Fade units.** `setBrightness:fadeSpeed:commit:forKeyboard:` is undocumented. I read the backlight's PWM duty cycle from the IORegistry during a `fadeSpeed: 2000` call and saw an even 2.0 second ramp, so the unit is milliseconds.
- **Idle-off.** While macOS holds the backlight off after inactivity, writes are accepted but don't light the keyboard. kbsync skips writes while the idle flag is set and syncs again when it clears.
- **Suppressed isn't asleep.** CoreBrightness also reports the backlight as suppressed whenever its level is 0%, and the next write lights it straight back up. I first treated suppressed as asleep, so once the screen hit 0% the keyboard stayed dark for good. Now only the idle flag holds writes back.
- **The light sensor drifts.** With "Adjust keyboard brightness in low light" on, I watched the keyboard move from 24.5% to 24.0% with nothing else touching it. That's why kbsync turns it off while running.

## How I measured it

Measured on a MacBook Pro (M1 Pro, macOS 26.6):

| Measure | Result |
|---|---|
| Idle | 0 wakeups, 0.0% CPU (app and command line) |
| Memory | Command line about 4.6 MB, app about 13 MB |
| Leaks | None. Command-line memory was unchanged after 20,000 brightness changes |
| Each change | About 0.1 ms of CPU |
| Delay | About 7 ms |

## Known limits

- The APIs are private, so a macOS update could break it. If something it needs is missing, kbsync exits and says what.
- I've tested it on an M1 Pro. Other Apple Silicon MacBooks should work, and Intel Macs are untested.
- The app isn't signed with a paid Apple Developer ID, so the first launch needs "Open Anyway" in System Settings.

## Run it

```bash
brew tap simar-s2/kbsync https://github.com/simar-s2/kbsync
brew install --cask simar-s2/kbsync/kbsync   # menu bar app
brew install simar-s2/kbsync/kbsync          # or the command-line tool
kbsync install                               # run in the background and at login
```
