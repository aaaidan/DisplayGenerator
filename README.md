# DisplayGenerator

*Tool to help design SSD1306 OLED displays on Particle devices*

I like to use the SSD1306-based displays in Particle projects. They're small and inexpensive. There are three commonly used versions:

- 128 x 64 white (0.96") 
- 128 x 32 short
- 128 x 64 yellow and blue, with the top 16 pixels yellow and the rest blue

They're available with I2C and SPI interfaces. I recommend I2C; it's fewer pins (D0 and D1 only) and the added speed of SPI is not worth the effort in my opinion.

On Particle devices, the [Adafruit GFX library](https://github.com/adafruit/Adafruit-GFX-Library) is typically used to draw to the display. It works great, but it's kind of a pain to have to adjust a pixel or two, recompile and flash your code, and repeat the process over and over.

This project is a web-based tool that allows you to design your display code from a web browser with instantaneous feedback as you adjust fonts, positions, etc.. This saves a lot of pain over making a code change, flashing it to your device, viewing the display, and repeating.

The code actually runs the Adafruit GFX code in your browser so the display behavior, fonts, etc. are pixel-perfect to an actual device!

To use the tool, go to the [DisplayGenerator Web Page](https://aaaidan.github.io/DisplayGenerator/public/). (It's just the public directory of this repository served by Github Pages.)

## What can you do with it?

Here's a sample screen:

![Main Screen](images/screen-editor.png)

At the top is the 3x enlarged display on the left and actual-sized display on the right

The Display Type popup allows you to choose a different display type. It's currently limited to standard SSD1306 monochrome displays.

The list is populated by four commonly used commands, but you can add, delete, and move them as desired.

As you edit the fields, for example change the y value for the setCursor command, the display immediate updates, as does the code box, below.

The add a command feature can be used for writePixel, drawLine, drawRect, fillRect, drawCircle, etc..

Save Layout and Load Layout can be used to save your design so you can load it later and continue to edit it.

Code is the generated code based on your settings.


The other major feature is the icon/bitmap generator. If you add a **drawIcon** command, an additional pane will appear:


## How it works

The entire thing is browser-based. I tested it in Chrome and Firefox. It might work on Safari. It probably won't work on Edge, and it definitely won't work on Internet Explorer. 

Odds are iffy on mobile, but it doesn't really make sense to use it on a mobile device anyway.

There are two main parts:

- The user interface part is a Vue.js application.
- The Adafruit GFX code runs using Emscripten.

[Emscripten](https://emscripten.org) takes C++ code and compiles it to WebASM. I have the Adafruit GFX library and some necessary utilities (like String) as the C++ source in the src directory. 

Emscripten generates the necessary bindings so I can call C++ code from Javascript. I added wrappers for all of the GFX calls and a call to read the bitmap data out as an array of bytes.

## Releases

#### 0.0.3-aidan
- Make it more about primitive display objects and less about draw commands.

#### 0.0.3

- Add gap between the yellow and blue parts of the display like an actual display.
- Add Invert Display option
- Add setTextColor(WHITE) by default
- Add setTextColor inverted option (only works with default font)
- Add clearDisplay() and display() to code automatically

#### 0.0.2 2019-07-23 

- Added printCentered option. Note that this only centers static text since GFX doesn't include a feature to automatically center text on the fly. It measures the text and generates the appropriate setCursor for you.

#### 0.0.1 2019-07-22 

Initial version!
