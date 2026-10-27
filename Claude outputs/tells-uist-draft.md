# Natural Signs on Everyday Objects: Rendering Machine-Known States as Indexical Cues in AR

*UIST paper draft v3. "SYSTEM" is a placeholder for the system name. Highlighted items need a decision (<mark>TBD</mark>) or a check (<mark>verify</mark>).*

---

## Abstract

Homes and workplaces are full of information about the physical world that people cannot perceive directly: a refrigerator door that is not quite shut, soil that has dried out below the surface, a bus that is a few minutes away, a pan handle that is still hot. Sensors, connected devices, and AI models increasingly know these states, but they report them as symbolic messages on a phone or a head-worn display, detached from the things they are about. Ambient displays offered a calmer alternative, yet they rely on dedicated artifacts and on mappings that people must learn in advance. We present SYSTEM, a system that renders structured information as *indexical cues*: the sign the state would naturally give off if people could perceive it, placed on the object it concerns or on an object whose function relates to it. A fridge door that is ajar spills cold mist from its gap; a wall clock starts to tick audibly as a meeting approaches; headlights sweep across the window as the bus nears. For each item, SYSTEM chooses where the cue appears and the ways it can show in each modality. A lifecycle manager then allocates modalities across all cues in a room, so that some are strong, some weak, and some absent for now, and SYSTEM renders each cue within what it is allowed, with a strength set by how far the state is from normal. We contribute a design space of indexical cues, the SYSTEM architecture implemented on Apple Vision Pro, and applications across everyday settings. <mark>[Add one sentence on evaluation once decided.]</mark>

---

## 1 Introduction

Where there is smoke, there is fire. Much of what people know about the physical world, they know without being told. Steam rising from a cup says the tea is hot. A kettle's rising hiss says the water is about to boil. Frost on a window says it is cold outside. These signs are not messages. They are produced by the state itself, they appear where the state is, and people read them with little effort because a lifetime of experience has taught them what such signs mean.

Many states that matter, however, give off no sign that people can perceive. A refrigerator door that looks closed may be leaking cold air. Soil can be dry several centimetres down while the plant still looks healthy. A metal handle looks the same hot or cold. A bus a few minutes away is neither visible nor audible. Increasingly, some system does know these states: a door sensor, a soil probe, a thermal camera, a transit feed, a calendar, or an AI model that infers them from video. Yet this knowledge reaches people almost always in the same form: a symbolic message, delivered to a phone, a watch, or a head-worn display, beside the world rather than in it. The person must read the message, work out what it refers to, and find that thing in the room.

Calm technology proposed a different relationship [Weiser and Brown 1996], and two decades of ambient and peripheral displays explored it [Ishii and Ullmer 1997; Pousman and Stasko 2006]. These displays moved information to the periphery, but they did so through dedicated artifacts, such as a string that shakes with network traffic or an orb that changes colour with the stock market, and through mappings that designers chose and people had to learn. Situated and embedded visualization later placed information at its physical referent [White and Feiner 2009; Willett et al. 2017], but kept symbolic encodings such as charts and labels. Most recently, AI-driven AR has made everyday objects interactive and even conversational [Dogan et al. 2024; Iwai and Matulic 2025], but again through symbolic output: menus and speech.

We ask a different question: *if a state could be perceived, what would it look or sound like, and where?* We answer it with *indexical cues*: signs of the kind a state would naturally give off, rendered on the object the state concerns. In semiotics, smoke is the classic example of an *index*: a sign causally connected to what it signifies [Peirce]. Pousman and Stasko already list indexical representation as one end of their representational fidelity dimension [2006]. SYSTEM generates such signs on demand, for states that the physical world itself leaves silent.

<mark>[Teaser figure: a kitchen in the morning. Cold mist spills from the gap of the fridge door. The handle of a pan on the stove has a warm red tint. Through the window facing the street, headlights sweep across the glass and the first raindrops appear. The wall clock glows faintly.]</mark>

SYSTEM sits between the systems that know and the person who acts. Upstream components (sensors, device APIs, AI models) submit information items in a common structured format; SYSTEM does not create information. It is built from two modules. The **representation module** works on one item at a time. When an item arrives, it chooses where the cue appears (the part of the referent where the state lives, an object whose function relates to the state, or a direction) and the ways the cue can show in each modality: a visual sign, a sound, and anchored text. These choices stay fixed for the item. The **lifecycle management module** works on all cues in a room at once. A room in which every object glows and makes sounds would be noisy, so this module decides, over time and with knowledge of where the person is and what they are looking at, how much each cue may use each modality: only one cue may sound at a time, visual cues that fit together may share an object, text appears only where the person is looking, and cues with low urgency far from the person are absent for now. The representation module then renders each cue within what it is allowed, with a strength set by how far the state is from normal.

This paper makes the following contributions:

1. **The concept of indexical cues** for presenting machine-known states of the physical world, and a **design space** that describes which cues are possible (additive emission and attachment, changes to the object itself, sound, anchored text) and where they can appear (referent, functional proxy, direction).
2. **SYSTEM**, an architecture that separates the representation of each item from the management of all cues in a room, implemented on Apple Vision Pro.
3. **Applications** across kitchen, home, and leaving-home scenarios, and a walkthrough of how several cues share one room.
4. <mark>[Evaluation contribution, TBD.]</mark>

---

## 2 Related Work

### 2.1 Ambient and Peripheral Displays

Weiser and Brown described calm technology as technology that moves easily between the center and the periphery of attention, using the Dangling String, a wire that shook with network traffic, as their example [1996]. Tangible Bits introduced ambient media as a class of interface [Ishii and Ullmer 1997], and ambientROOM rendered remote activity as light ripples, sound, and airflow inside an architectural space [Ishii et al. 1998]. Later systems embedded information in decorative objects such as the Information Percolator [Heiner et al. 1999], in family portraits [Mynatt et al. 2001], and in background audio that changed as people moved through an office [Mynatt et al. 1998]. Toolkits and evaluation methods followed [Mankoff et al. 2003; Matthews et al. 2004], along with a taxonomy that characterizes ambient information systems by information capacity, notification level, representational fidelity, and aesthetic emphasis [Pousman and Stasko 2006]. Evaluating such systems in the wild proved difficult [Hazlewood et al. 2011]. Commercial products such as the Ambient Orb carried the idea into homes.

Three properties are common to this body of work. First, the information concerns something other than the display: network load, stock prices, a family member elsewhere. Second, the display is a dedicated artifact added to the environment. Third, the mapping between data and display is chosen by a designer and must be learned by the user. SYSTEM differs on all three: the cue appears on or near the thing the information is about, the carrier is an object already in the environment, and the cue takes the form of a sign that the state would naturally produce, so that its meaning draws on what people already know. Work on auditory augmentation, which modifies the sound an object makes to convey data [Bovermann et al. 2010; Weger et al. 2022], is closest to this last property; SYSTEM generalizes it across modalities and to states that produce no sound of their own. Managing attention across several peripheral displays was addressed by the Peripheral Display Toolkit [Matthews et al. 2004]; SYSTEM's lifecycle management plays a related role for many cues placed on objects in one room.

### 2.2 Situated Information in Augmented Reality

Situated visualization displays data in the physical context it refers to [White and Feiner 2009], and embedded data representations place visual encodings directly on their physical referents [Willett et al. 2017]. Head-worn AR has made such placement practical, and work on glanceable AR studies how to keep such information available at a glance [Lu and Bowman <mark>[verify venue/year]</mark>]. Mixed-reality systems have also manipulated real-world sound to support awareness [Chang et al. 2023; Chang et al. 2024]. Proactive assistants on wearable devices decide when to present information [Pu et al. 2025 <mark>[verify authors]</mark>] and how to guide physical tasks [Zhao et al. 2025, Guided Reality <mark>[verify]</mark>], but present it as text, speech, or virtual overlays separate from the objects involved.

These systems answer *where* information should appear; their encodings remain symbolic or abstract. SYSTEM keeps the situated placement and changes the encoding: the cue is a sign of the state rather than a description of it.

### 2.3 Augmenting Everyday Objects

A line of work repurposes everyday objects opportunistically, mostly as input: as AR controllers [Henderson and Feiner 2008], as haptic proxies in VR [Hettiarachchi and Wigdor 2016], or as tangible interfaces assembled on the fly [Du et al. 2022; Ubi-TOUCH 2023 <mark>[verify authors]</mark>]. Recent systems use multimodal language models to turn objects into points of access to AI, attaching context menus to them [Dogan et al. 2024] or giving them personalities that converse with the user [Iwai and Matulic 2025]. Others add robotic actuation so that objects can physically act on behalf of the user [Towards Unobtrusive Physical AI, UIST 2025 <mark>[verify authors]</mark>].

These systems make objects serve as input devices, as conversational partners, or as actuators. SYSTEM uses everyday objects as *output carriers* and generates non-symbolic output: what the object, or the state it concerns, would look or sound like if the state were perceivable.

**Table 1. Positioning.**

| | Hand-designed, dedicated artifact | Generated, everyday objects |
|---|---|---|
| **Not situated** (display elsewhere, arbitrary mapping) | Ambient displays: Dangling String, Ambient Orb, ambientROOM | Objects as input: Opportunistic Interfaces, Ubi-TOUCH, Annexing Reality |
| **Spatially situated, symbolic output** | Situated and embedded visualization | XR-Objects, talking objects |
| **Semantically situated, indexical output** | Natural signs the physical world already gives off (steam, frost, a kettle's hiss) | **SYSTEM** |

---

## 3 Design Space

### 3.1 Information Items

SYSTEM receives information from upstream components that have already formatted it. Each item describes what the information is about and its value; it says nothing about presentation.

| Dimension | Values | Example |
|---|---|---|
| Referent presence | in the scene / not in the scene | fridge door / a bus on the street |
| Value type | binary, level, countdown, forecast | door open; handle at 70°C; meeting in 5 min; rain likely within 30 min |
| Normal state | the value at which nothing needs to be shown | door closed; handle below 45°C |
| Urgency | low to high | dry soil (low); bus about to arrive (high) |

### 3.2 Cue Space

| Modality | Category | Type | Description | Example |
|---|---|---|---|---|
| Visual | Additive | **Emit** | something leaves the object | cold mist from a door gap |
| Visual | Additive | **Attach** | something from outside lands on the object | raindrops on a window |
| Visual | Change to the object | **Material** (incl. colour) | the object's surface looks different | a handle turns warm red |
| Visual | Change to the object | **Position, size, shape** | the object moves or deforms | <mark>[examples TBD]</mark> |
| Sound | | **Sound** | a sound from the carrier or from a direction | a clock ticks; an engine approaches |
| Text | | **Anchored text** | short text placed at the carrier | "Bus 204 · 4 min" next to the window |

Changes to the object can be **periodic** or **steady**. A cue can use several modalities at once.

### 3.3 Carrier

A cue appears on one of three kinds of carrier, tried in order:

| Order | Carrier | When | Example |
|---|---|---|---|
| 1 | **Referent**, at the part where the state lives or where the hands touch it | the referent is in the scene | gap of the fridge door; soil of a plant; handle of a pan |
| 2 | **Functional proxy**, an object whose function relates to the information | the referent is not in the scene | window for weather; clock for time; window facing the street for a bus |
| 3 | **Direction** of the referent | no object can carry it | the street, for a sound |

### 3.4 Principles

We derived the following principles while selecting and rejecting candidate use cases. <mark>[The formative study may refine them, see 6.]</mark>

| Principle | Rejected example |
|---|---|
| **Reality is insufficient.** A cue is warranted only when the physical world does not already provide adequate perceptible information. | pouring into a cup, sanding, searing a steak |
| **The cue does not contradict the object's real state.** A change to an object's appearance must not depict a state it is not in; an additive cue is used instead. | a plant shown wilting before it wilts |
| **The cue depicts a real process.** | a draft from a door that is closed but unlocked |
| **The carrier's function matches the information.** | an email shown on a desk |
| **States are continuous or persistent rather than awaited events.** For an awaited discrete event, a direct notification is preferable. | an oven finishing preheating |
| **Safety-critical information is out of scope.** Explicit alarms are more appropriate. | a gas leak; an icy pavement |
| **The physical world is the scope.** | a model training run; a coding agent |

### 3.5 Indexical and Digital Layers

Cues need not be purely analog. An indexical layer is readable at a glance; anchored text adds precision, for example the exact minutes until the bus arrives. In SYSTEM, anchored text is one of the modalities of a cue. It is placed at the same carrier as the indexical sign, so it stays situated, and whether it is shown is decided together with the other modalities (Section 4.5).

### 3.6 Many Cues in One Room

A room holds many items at once. If every cue used every modality, the room would be noisy: several sounds would overlap, and many objects would glow at the same time. The design space therefore includes how cues share a room: which cues are strong, which are weak, and which are absent for now, and which modalities each may use. Sound is a shared channel in which cues collide; visual cues can coexist when they are spatially apart or fit together on one object; text competes for the person's gaze.

---

## 4 SYSTEM

### 4.1 Overview

<mark>[Figure 2: architecture, see pipeline_v8.svg]</mark>

SYSTEM consists of two modules (Figure 2). The representation module handles one item at a time; the lifecycle management module handles all cues in a room. The representation module never sees other items or the person; the lifecycle management module never sees what a cue looks or sounds like, only where it is and which modalities it can use. Processing runs in this order:

| Order | Module | Step | When | Performed by |
|---|---|---|---|---|
| 1 | Representation | Choose where, and the ways the cue can show in each modality | once, when the item arrives; fixed afterwards | LLM |
| 2 | Lifecycle management | Allocate, for every cue in the room, how much it may use each modality | whenever items, values, or the person's context change | rules |
| 3 | Representation | Show the cue within what it is allowed | whenever the item's value or its allowance changes | rules |

### 4.2 Information Item Format

```json
{
  "id": "i-bus-01",
  "source": "transit.formatter",
  "referent": { "label": "Bus 204", "anchor_id": null },
  "quality": "arrival.approaching",
  "value": { "type": "countdown", "eta_s": 240 },
  "urgency": 0.8,
  "text": { "short": "Bus 204 · 4 min", "detail": "Stop: Broadway & 13th" }
}
```

| Field | Role |
|---|---|
| `id` | identifies the item across both modules |
| `referent.anchor_id` | the tracked object in the scene, or `null` when the referent is not in view |
| `quality` | the physical quality the state concerns, from a small vocabulary (for example `thermal.hot`, `thermal.cold`, `moisture.dry`, `precipitation`, `time.approaching`, `arrival.approaching`); guides the choice of sign |
| `value` | value type and normal state; sets the cue's strength |
| `urgency` | used by lifecycle management to prioritize cues |
| `text` | content of the anchored text |

Other value types:

```json
{ "type": "binary",    "value": true, "ok": false }
{ "type": "level",     "value": 70, "unit": "°C", "ok_below": 45, "max": 120 }
{ "type": "forecast",  "probability": 0.8, "eta_s": 1800 }
```

### 4.3 Scene

We implement SYSTEM on Apple Vision Pro. Everyday objects that can serve as referents or proxies (fridge, pan, plant pot, window, wall clock) are tracked with visionOS object tracking using reference objects created from scanned 3D models <mark>[verify pipeline details]</mark>. Each object's 3D model is annotated once with its carrier parts (for example the door gap or the pan handle). Directions to off-scene referents, such as the street, are annotated in the room. The scene description passed to the model lists the tracked objects with their labels, categories, parts, and positions, plus the annotated directions.

### 4.4 Representation: Where and Ways to Show

When an item arrives, the model makes two choices together, because the carrier is chosen partly for the signs it can give off (a clock for its ticking, a window for raindrops):

- **Where.** If `anchor_id` is present, the part of the referent where the state lives or where it would be touched. Otherwise, a functional proxy from the scene description. If none fits, a direction.
- **Ways to show.** For each modality, the sign the state would give off on that carrier, chosen from a library of signs. The model answers one question per modality: *if this state could be perceived, what would it look or sound like here?* The anchored text comes from the item's `text` field.

Each cue must have at least one quiet modality, usually visual, so that lifecycle management can always keep it present in a weak form. This requirement can change the carrier: a bus would otherwise be represented by an engine sound from the street alone, so the model places it on the window facing the street, where headlights can sweep across the glass.

The output is fixed for the life of the item:

```json
{
  "item_id": "i-bus-01",
  "where": { "object": "obj-window-street", "part": "glass" },
  "ways": {
    "visual": "headlights sweeping across the glass",
    "sound":  "engine approaching, from the street direction",
    "text":   "Bus 204 · 4 min"
  }
}
```

**Library of signs.**

| Sign | Cue type | Modality |
|---|---|---|
| cold mist | Emit | visual |
| dry dust | Emit | visual |
| raindrops on glass | Attach | visual |
| headlights sweeping across glass | Attach | visual |
| warm tint | Material, steady | visual |
| faint glow of a clock face | Material, steady | visual |
| dry crackle | steady | sound |
| ticking | periodic | sound |
| engine | periodic, directional | sound |
| distant rain | steady | sound |

<mark>[TBD: size of the library; whether the model may propose signs outside the library.]</mark>

### 4.5 Lifecycle Management

Lifecycle management receives every item with its urgency, the where and available modalities of every cue, and the person's context (position and view). Human context enters SYSTEM only here. It outputs, for every cue, how much it may use each modality, from 0 (off) to 1. A cue whose allowances are all 0 is absent for now. Our current rules are:

| Rule | Effect |
|---|---|
| One sound at a time | the sound channel goes to the most urgent cue; other cues fall back to their visual sign |
| Visual signs that fit together may share an object | raindrops and headlights can appear on the same window |
| Few visual cues in view | beyond a small number, the less urgent ones are weakened, not removed |
| Text only where the person is looking | or for the most urgent cue |
| Low urgency and far from the person | the cue is absent for now and returns when the person comes near |

```json
{ "item_id": "i-bus-01", "allow": { "visual": 0.8, "sound": 1.0, "text": 1 } }
```

<mark>[TBD: how urgency, proximity, and gaze combine into a priority; transitions when allowances change; whether lifecycle management also handles when items begin and end.]</mark>

Because the interface between the modules is this small, the representation module also runs without lifecycle management, with every allowance set to 1.

### 4.6 Representation: Show Within What Is Allowed

Each modality's strength is the value's strength multiplied by its allowance. The value's strength reflects how far the state is from normal:

| Value type | Strength | Rhythm |
|---|---|---|
| binary | 1 when not normal, otherwise 0 | constant |
| level | (value − ok) / (max − ok), clamped to [0, 1] | constant |
| countdown | 1 − eta / T, clamped | 1 − eta / T, clamped |
| forecast | probability × (1 − eta / T), clamped | constant |

T is a horizon, for example 600 s. A minimum strength keeps a cue perceivable while it is allowed. For the bus four minutes away, the strength is 0.6, so the engine plays at 0.6 × 1.0 and the headlights at 0.6 × 0.8, and the text is shown. This step is repeated whenever the value or the allowance changes; where the cue is and its ways to show do not change.

### 4.7 Rendering

| Modality / cue type | Implementation on visionOS (RealityKit) |
|---|---|
| Emit | particle emitter anchored to the carrier part |
| Attach | particles constrained to, or decals on, the carrier surface |
| Material | shader material on the object's model, aligned with the tracked object |
| Position, size, shape | <mark>[method TBD]</mark> |
| Sound | spatial audio source at the carrier part or along an annotated direction |
| Anchored text | text placed next to the carrier part |

<mark>[TBD: language model, latency.]</mark>

---

## 5 Applications

### 5.1 Scenarios

| Setting | Scenario | Why reality is insufficient | Ways to show | Carrier | Value type |
|---|---|---|---|---|---|
| Kitchen | Fridge door ajar | the door looks closed while cold air leaks out | cold mist from the gap; text: how long it has been open | referent part | binary |
| Kitchen | Hot pan handle | metal looks the same hot or cold | warm red tint; text: temperature | referent part | level |
| Kitchen | Tea cooling | steam is an unreliable guide to temperature | steam that thins as it cools; text: temperature | referent part | level |
| Home | Dry plant | the plant looks healthy until too late; the surface hides moisture below | fine dust from the soil; a faint dry crackle; text: last watered | referent part | level |
| Home | Rain approaching | the weather has not changed yet and cannot be seen from inside | raindrops on the window; distant rain; text: when | functional proxy | forecast |
| Leaving home | Meeting soon | the clock is silent and the person is not looking at it | faint glow of the clock face; ticking that quickens; text: meeting name and time | functional proxy | countdown |
| Leaving home | Bus approaching | the bus is neither visible nor audible | headlights sweeping across the window; engine from the street; text: minutes to arrival | functional proxy, sound from a direction | countdown |

### 5.2 Walkthrough: A Morning

A person is making breakfast before a 9:00 meeting and plans to take the 8:40 bus. The table shows what lifecycle management allows each cue at three moments (visual / sound / text; "–" means the cue has no such modality).

| Cue | 8:25, at the stove, looking at the pan | 8:32, walking past the plant | 8:36, putting on a coat, looking at the window |
|---|---|---|---|
| Pan handle | 1.0 / – / 0 | 0.5 / – / 0 | absent |
| Plant | absent | 0.6 / 0.4 / 0 | absent |
| Meeting | 0.3 / 0 / 0 | 0.4 / 0 / 0 | 0.5 / 0 / 0 |
| Bus | absent | 0.4 / 0 / 0 | 0.8 / 1.0 / 1 |
| Rain | 0.3 / 0 / 0 | 0.5 / 0 / 0 | 0.7 / 0 / 0 |
| Fridge door (from 8:36) | | | 0.7 / – / 0 |

At 8:25 the pan handle is red and close to the person's hand; the clock and the window change only faintly. At 8:32, passing the plant, the person hears a faint dry crackle and sees dust lift from the soil, without being interrupted. At 8:36 the engine sound approaches from the street, headlights sweep across the window together with a few raindrops, and "Bus 204 · 4 min" appears beside it. The meeting has given up its sound to the bus and remains as a faint glow on the clock. On the way out, the person sees cold mist at the fridge door and closes it, and the mist stops.

---

## 6 Evaluation <mark>[TBD]</mark>

| Study | Description | Open questions |
|---|---|---|
| **Formative study** | Participants receive example events and the design space, and design the ideal cue for each (carrier and ways to show). | <mark>[TBD]</mark> Is it a design input that refines the principles in 3.4, a ground truth for assessing the representation module's choices, or both? |
| **Perception study** | Compare the same information presented as an indexical cue only, an indexical cue with anchored text, and text only. | <mark>[TBD]</mark> Measures. |
| **Technical evaluation** | Quality of the representation module's choices; latency. | <mark>[TBD]</mark> Depends on whether a ground truth exists. |

---

## 7 Discussion

**Expressivity versus readability.** Indexical cues draw on what people already know, but what an object can plausibly show is limited by what it is. Arbitrary mappings can express anything but must be learned. SYSTEM trades expressivity for readability; anchored text is one way to recover precision without giving up the indexical form.

**Destination and fallback.** Some information has no physical referent and no functional proxy, such as email or network status. The carrier chain in Section 3.3 ends at a direction, but some items have no meaningful direction either. Whether such items should fall back to symbolic output, or are simply outside the scope of indexical cues, is an open question.

**Belonging versus legibility.** A cue that looks real may be taken for a real event. Cues should belong to the scene and still be recognizable as augmented, for example through a consistent visual or sonic signature, or through anchored text.

**Lifecycle policies.** Our lifecycle rules are simple and hand-written. How priorities should combine urgency, proximity, and gaze, how cues should move between strong, weak, and absent, and whether these policies should adapt to a person, are open questions.

**Limitations.** SYSTEM relies on digital twins of the environment and on objects being registered in advance, which limits it to prepared environments. Safety-critical information is out of scope. The choices of carrier and signs depend on the language model and can fail.

---

## 8 Conclusion

<mark>[To write after evaluation.]</mark>

---

## References <mark>[to complete and verify]</mark>

- Bovermann, T., Tünnermann, R., Hermann, T. 2010. Auditory Augmentation. *International Journal of Ambient Computing and Intelligence.*
- Chang, R.-C., Hung, C.-S., Jain, D., Guo, A. 2023. SoundBlender: Manipulating Sounds for Accessible Mixed-Reality Awareness. *UIST Adjunct.*
- Chang, R.-C., et al. 2024. SoundShift: Exploring Sound Manipulations for Accessible Mixed-Reality Awareness. *DIS.*
- Dogan, M. D., et al. 2024. Augmented Object Intelligence with XR-Objects. *UIST.*
- Du, R., et al. 2022. Opportunistic Interfaces for Augmented Reality: Transforming Everyday Objects into Tangible 6DoF Interfaces Using Ad hoc UI. *CHI Extended Abstracts.*
- Hazlewood, W. R., Stolterman, E., Connelly, K. 2011. Issues in Evaluating Ambient Displays in the Wild: Two Case Studies. *CHI.*
- Heiner, J. M., Hudson, S. E., Tanaka, K. 1999. The Information Percolator: Ambient Information Display in a Decorative Object. *UIST.*
- Henderson, S. J., Feiner, S. 2008. Opportunistic Controls. *VRST.* <mark>[verify]</mark>
- Hettiarachchi, A., Wigdor, D. 2016. Annexing Reality. *CHI.*
- Ishii, H., Ullmer, B. 1997. Tangible Bits. *CHI.*
- Ishii, H., et al. 1998. ambientROOM: Integrating Ambient Media with Architectural Space. *CHI Summary.*
- Iwai, N., Matulic, F. 2025. Bringing Everyday Objects to Life in Augmented Reality with AI-Powered Talking Characters. *CHI Extended Abstracts.*
- Lu, F., Bowman, D. A. Glanceable AR. <mark>[verify]</mark>
- Mankoff, J., et al. 2003. Heuristic Evaluation of Ambient Displays. *CHI.*
- Matthews, T., Dey, A. K., Mankoff, J., Carter, S., Rattenbury, T. 2004. A Toolkit for Managing User Attention in Peripheral Displays. *UIST.*
- Mynatt, E. D., Back, M., Want, R., Baer, M., Ellis, J. B. 1998. Designing Audio Aura. *CHI.*
- Mynatt, E. D., Rowan, J., Craighill, S., Jacobs, A. 2001. Digital Family Portraits. *CHI.*
- Peirce, C. S. On signs (icon, index, symbol). <mark>[choose citation]</mark>
- Pousman, Z., Stasko, J. 2006. A Taxonomy of Ambient Information Systems: Four Patterns of Design. *AVI.*
- Pu, K., et al. 2025. ProMemAssist. <mark>[verify authors and venue]</mark>
- Weger, M., Hermann, T., Höldrich, R. 2022. AltAR/table: A Platform for Plausible Auditory Augmentation. <mark>[verify venue]</mark>
- Weiser, M., Brown, J. S. 1996. Designing Calm Technology. *PowerGrid Journal.*
- White, S., Feiner, S. 2009. SiteLens: Situated Visualization Techniques for Urban Site Visits. *CHI.*
- Willett, W., Jansen, Y., Dragicevic, P. 2017. Embedded Data Representations. *IEEE TVCG.*
- Zhao, A. Y., et al. 2025. Guided Reality. *UIST.* <mark>[verify]</mark>
- Ubi-TOUCH. 2023. *UIST.* <mark>[verify authors]</mark>
- Towards Unobtrusive Physical AI. 2025. *UIST.* <mark>[verify authors]</mark>
