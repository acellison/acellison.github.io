# Metric Garden

## Intro
**Metric Garden** is a rhythmic playground meant for exploration, composition and practice.  Rhythmic patterns are
represented as **Trees**, which consist of, well, a tree structure!  In Metric Garden you will interact with rhythmic
ideas by recursively subdividing time.  I built it because I find piano-roll editing of drums extremely unintuitive,
especially with odd meters and tuplets.  Metric Garden is designed to make these explorations simple, with a visual
structure that corresponds more closely to musicality than a grid of notes does.

Trees are made up of **Nodes**, which each correspond to a unit of time and carry MIDI events.  Rhythmic nesting is
encoded in the parent-child relationship among Nodes.  Each Node in the **Graph** is traversed in a counterclockwise
order.  The duration of each Node is measured by the relationship of its **Count** to the Tree structure as a whole.
Count can be any integer or ratio of integers - the entire Tree is divided up into discrete time chunks based on its
structure.

To get a feel for how Trees, Nodes and Counts relate to musical events, let's get started with an example.  In the
left-hand menu lives the **Trees Sidebar**. Click the Plus button to add a new Tree. It starts out blank - just a **Root
Node** - and is ready for subdivision.  Select the Tree in the Trees Sidebar and its **Tree Editor** pops up on the
right side of the UI.  The editor contains Tree metadata - its name, the **Beat Value**, the MIDI Channel, and the
selected MIDI Map.  The Beat Value determines what a Count of one means relative to the tempo of the project.  Here we
default to sixteenth notes.  You can type any fraction into the Beat Value to change its relationship to the pulse.

The next menu down is the **Fill** menu.  This contains the MIDI notes we assign to individual Nodes in a generated
sequence.  Leave these at their defaults for now.  The names come from the selected MIDI Map, which you can customize
later.

Below this is the **Subdivide** text box.  This is an extremely powerful and flexible tool used to quickly generate
rhythmic sketches.


## Initial Setup
For these examples you can either use the built-in drum synthesizer, or connect the browser's MIDI streams to your DAW.

### Built-In Drums
To enable the built-in drums, click the **Settings** tab and press **Connect Output**.  A modal dialog will popup that
you should allow so that your browser can connect to MIDI streams.  Under the **Drums** tab ensure **Built-In Drums** is
selected.  Leave **Output** set to `Select Output`, **Sync** set to `Internal` and choose a pulse **BPM**.

### Ableton Integration
To connect the MIDI output of the plugin to a DAW, ensure you have your MIDI driver set up. For macOS this means
enabling the IAC Driver in Audio MIDI Setup. Google it. Click the dropdown in the **Output** field and select `IAC
Driver Bus 1`.  Set **Sync** to `Follow MIDI Clock` and set **Clock In** to `IAC Driver Bus 1`.  In the Drums tab
deselect Built-In Drums.

In Ableton's Settings (`Cmd+,`) go to the **Link, Tempo & MIDI** section and make sure `IAC Driver (Bus 1)` has both
**Track** and **Sync** selected.  Now create two MIDI tracks. On the first, load up your favorite drum kit.  Set **MIDI
From** `IAC Driver (Bus 1)` and set the channel to `Ch. 1`.  On the second track add an `External Instrument`.  Set
`MIDI To` to `IAC Driver (Bus 1)` and set the channel to `Ch. 1`. 

Ableton is set up to control MIDI transport, and Metric Garden will sync to it.


## Getting Started
Let's get a feel for how Metric Garden works by walking through a few examples.  Return to the **Graph View** by
clicking the tab at the top of the UI.

### Example 1: Basic 4
In the Subdivide text box, type, without quotes, the number `4` and press Enter.  This subdivides the Root into four
leaf Nodes, each with count one. Each leaf gets a MIDI attached to it, which you can see denoted by the spiral glyph,
where different colors correspond to different notes in the MIDI Map.  Observe in the Graph View the Root node now shows
a value of 4 - this is its Count, and it was automatically adjusted to accommodate the unit-count leaves. 

Press the Space Bar to play the sequence.

Click on one of the leaf Nodes in the Graph view.  This pops up the **Node Editor** in the right-hand panel.  Change the
Count to 2 and listen to the pattern.  Now observe how the Root's Count was incremented to 5.  This feature is called
**Auto-Sum**. It keeps a Node's Count locked to the sum of its children's Counts.  This has the effect of maintaining
the underlying sixteenth-note structure even when Nodes have their durations change.

### Example 2: Basic 12
Let's start nesting our subdivisions.  Select the Tree in the Trees Sidebar and return to its Subdivide menu. Type the
string `4,4,4`.  This create three groupings of four notes.  You can see how logically grouping Nodes allows us to
quickly generate more complex rhythmic patterns.  Experiment with dragging Nodes around the Graph View - when you
reorder nodes relative to their counterclockwise ordering you likewise change when they arrive in time.  This lets you
mutate the already-generated Tree structure on the fly, moving accent notes or particular drum hits around as you
please.

Select the Root Node. In the Node Edidtor adjust the **Volume** and observe the note glyph fill ratios change along with
it.  Increasing the **Temperature** sets the amount of randomness in the MIDI generation. Temperatures below 0.5 cause
random fluctuations in the emitted velocities. Higher temperatures add a chance to trigger note ratchets. Ratchets have
a variable number of subdivisions depending on the temperature, and emitted notes always subdivide the true note.

### Example 3: Odd Groove
Let's get a little more groovy.  In the Subdivide menu type `5,4,3,(1,(1/2,1/2),1)` and hit Enter. This creates a rhythm
in 15 with distinct groupings.  Notice how the second Node in the fourth grouping has yet another nested layer of rhythm
- those are notes of half the duration of your Beat Value.

### Example 4: Hemiola
Time for our first polyrhythm. Return to the Tree Editor and set Beat Value to 1/2.  Now set the Subdivide input to
`3|2`. Behold! This creates a 3-over-2 polyrhythm with a duration of one half note.  You can change the duration of the
polyrhythm by appending a duration specifier.  For example, for the cycle to complete in the span of two half notes,
type `(3|2):2`.

Select the Root to bring up its Node Editor.  In the **Children** menu are four buttons: **A**, **M**, **R** and **C**.
When A = All is selected all the Parallel Node's children play out simultaneously.  This is the standard polyrhythm
format.  When you want to only one of the children at a time use the other buttons:
- **A**: All. Plays all children simultaneously.
- **M**: Manual. Mutually exclusive selection through Mute selection on the children
- **R**: Random. Randomly cycle between children.
- **C**: Cycle: Each iteration plays the next one in cycle. Basically a Seqential Node.

### Example 5: Triple Poly
Beat Value = `1/4`. Subdivide = `(5|4|3):5`. Wow.

## Summary
I hope this gives you an idea of how flexible and powerful the Subdivide concept is. Chain together complex groupings to
create a large rhythmic structure.  My goal for Metric Garden is to make these explorations easy and fun, and to tie the
rhythmic structures to meaningful visualizations.

