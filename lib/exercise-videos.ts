// Curated map of exercise name -> a verified, embeddable YouTube video ID, used
// by the in-session "Videos" modal to play a form demo inline. IDs were checked
// for existence + embeddability (YouTube oEmbed) when this map was authored.
//
// Most entries are exercise-name matches against the My PT Hub demo channel
// (youtube.com/@MyPTHub), cross-referenced with public/json/exercises.json; the
// rest are hand-picked aliases for common free-form names (e.g. "squat"). Names
// are normalized (lowercase). Exercises without a mapping fall back to the
// YouTube/TikTok search buttons. Extend by adding entries below.

const EXERCISE_VIDEOS: Record<string, string> = {
  "3/4 sit-up": "qIyuxNyZ0NQ", // 3:4 Sit Up
  "air bike": "CXEcOthC110", // Air Bike
  "alternate hammer curl": "Gub3VAcHhL8", // Alternate Hammer Curl
  "alternate heel touchers": "sYGvWaFQOuw", // Alternate Heel Touchers
  "alternate incline dumbbell curl": "laZYneFc-HA", // Alternate Incline Dumbbell Curl
  "alternating cable shoulder press": "JAofe8QKCR8", // Alternating Cable Shoulder Press
  "alternating deltoid raise": "pZVm-ZlyPoI", // Alternating Deltoid Raise
  "alternating floor press": "2F4rywQANe8", // Alternating Floor Press
  "alternating kettlebell press": "f1RQTKKAG1w", // Alternating Kettlebell Press
  "ankle circles": "dCrL4MCpmUM", // Ankle Circles
  "anti-gravity press": "cVLKynh655o", // Anti-Gravity Press
  "arm circles": "lmPHXmuR4mo", // Arm Circles
  "arnold dumbbell press": "KqZzF0rwwAA", // Arnold Dumbbell Press
  "around the worlds": "FsoM2-NOkkw", // Around The Worlds
  "axle deadlift": "8ZZmpEQQwgk", // Axle Deadlift
  "band assisted pull-up": "V1HReZM7a6w", // Band Assisted Pull Ups
  "band hip adductions": "4AI7AKDOsUA", // Band Hip Adduction
  "band pull apart": "s4S7BdmVfRw", // Band Pull Apart
  "band skull crusher": "zVFahHKFLvk", // Band Skull Crusher
  "barbell ab rollout": "JDbvtIuBnMc", // Barbell Ab Rollout
  "barbell bench press - medium grip": "hWbUlkb5Ms4",
  "barbell curl": "rt0M5P20ebQ", // Barbell Curl
  "barbell curls lying against an incline": "lrV5A-HaEuk", // Barbell Curl Lying Against An Incline
  "barbell deadlift": "uQFZFwrg2VE", // Barbell Deadlift
  "barbell full squat": "rrJIyZGlK8c",
  "barbell glute bridge": "yYCc2HDLfO8", // Barbell Glute Bridge
  "barbell guillotine bench press": "cqJ2jm_YkaU", // Barbell Guillotine Bench Press
  "barbell hack squat": "YkU5n_GXUU4", // Barbell Hack Squat
  "barbell hip thrust": "TSz4XEoFSFw", // Barbell Hip Thrust
  "barbell incline bench press - medium grip": "98HWfiRonkE",
  "barbell incline shoulder raise": "3Y_RFoYl-dk", // Barbell Incline Shoulder Raise
  "barbell lunge": "gWeyziUtsa0", // Barbell Lunges
  "barbell rear delt row": "P9cXUGEJKbw", // Barbell Rear Delt Row
  "barbell rollout from bench": "RVGYevyytlc", // Barbell Rollout From Bench
  "barbell row": "Nqh7q3zDCoQ",
  "barbell seated calf raise": "drNzvpIuTGM", // Barbell Seated Calf Raise
  "barbell shrug": "ibbeNcOeZv8", // Barbell Shrug
  "barbell shrug behind the back": "NYclHLyUFn0", // Barbell Shrug Behind The Back
  "barbell side bend": "b_5X0GbWSss", // Barbell Side Bend
  "barbell side split squat": "lVnYyeG5p8w", // Barbell Side Split Squat
  "barbell squat": "HljthpBlZVA", // Barbell Squat
  "barbell squat to a bench": "VPds8GE5Fjk", // Barbell Squat To A Bench
  "barbell step ups": "2SIHLrw5EBo", // Barbell Step-Ups
  "barbell walking lunge": "YSh0CDCuaOE", // Barbell Walking Lunges
  "battling ropes": "1gNMRV1GUFg",
  "bench dips": "JVhG3GkF71o", // Bench Dips
  "bench press": "hWbUlkb5Ms4",
  "bench sprint": "f9opH_r6k9I", // Bench Sprint
  "bent over barbell row": "lL7rdQjRIVI", // Bent Over Barbell Row
  "bent over low-pulley side lateral": "Dg__TBaN1qo", // Bent Over Low-Pulley Side Lateral
  "bent over one-arm long bar row": "IHlkbFF4_e8", // Bent Over One-Arm Long Bar Row
  "bent over row": "Nqh7q3zDCoQ",
  "bent-arm barbell pullover": "0wS1mVIk100", // Bent Arm Barbell Pullover
  "bent-arm dumbbell pullover": "QI2wOrMCzwc", // Bent-Arm Dumbbell Pullover
  "bent-knee hip raise": "R7Se3TSe1w4", // Bent Knee Hip Raises
  "bicep curl": "XE_pHwbst04",
  "bicycling, stationary": "rEqRmKAQ5xM",
  "body tricep press": "bHTZESCqtHs", // Body Tricep Press
  "bodyweight flyes": "C9JSBMCFdL0", // Bodyweight Flyes
  "bodyweight squat": "NrKLFHsWnCM", // Bodyweight Squats
  "bodyweight walking lunge": "SEPec1bcp1E", // Bodyweight Walking Lunges
  "bottoms up": "PShU9VHu-Co", // Bottoms Up
  "box jump (multiple response)": "BLVDRvaS6Nc", // Box Jumps
  "box squat": "9MWwluwwJbU", // Box Squats
  "bradford/rocky presses": "utxC_-PuRVs", // Bradford:Rocky Presses
  burpee: "qLBImHhCXSw",
  "cable chest press": "bZPtYUSb-qU", // Cable Chest Press
  "cable crossover": "aT5grk7nPPI", // Cable Crossover
  "cable crunch": "T4y1rB-UVV4", // Cable Crunch
  "cable deadlifts": "uDuf_zJZrdI", // Cable Deadlifts
  "cable hip adduction": "e8ZhzDSHbKs", // Cable Hip Adduction
  "cable incline pushdown": "BRkbf7tBE88", // Cable Incline Pushdown
  "cable incline triceps extension": "ssuwxIrp0Ko", // Cable Incline Triceps Extension
  "cable internal rotation": "Q_pdXVIBs0c", // Cable Internal Rotation
  "cable iron cross": "SyrQiwTukUg", // Cable Iron Cross
  "cable lying triceps extension": "LWW0tvlgC24", // Cable Lying Triceps Extension
  "cable one arm tricep extension": "3y7I__ln9jw", // Cable One-Arm Tricep Extension
  "cable preacher curl": "EOm_vu__o4M", // Cable Preacher Curl
  "cable reverse crunch": "Vv2e6HEsWnY", // Cable Reverse Crunch
  "cable rope overhead triceps extension": "N_sB9zC2oMU", // Cable Rope Overhead Triceps Extension
  "cable rope rear-delt rows": "_tQwrOM37g4", // Cable Rope Rear Delt Rows
  "cable russian twists": "WjYjVAnJU7M", // Cable Russian Twists
  "cable seated crunch": "j3oQDKmMliU", // Cable Seated Crunch
  "cable seated lateral raise": "Gg1cCNLmjSM", // Cable Seated Lateral Raises
  "cable shrugs": "3Tp08q3ARAo", // Cable Shrugs
  "calf raise": "n-5T_oYc1oU",
  "calf raises - with bands": "LVJvnfkIfNw", // Calf Raises With Bands
  "car deadlift": "w5gRp2NQxlQ", // Car Deadlift
  "car drivers": "N-LyAACMuuM", // Car Drivers
  "chair squat": "oKbxITeBikc", // Chair Squat
  "chest fly": "rk8YayRoTRQ",
  "childs pose": "1a8JQcEQI9Y", // Childs Pose (Beginner)
  "chin-up": "IbuEsDYpR_Q", // Chin Ups
  clean: "aqgMV_71fKw", // Clean
  "clean and jerk": "wp7xb7JV6S4", // Clean And Jerk
  "clean and press": "05LGv6TnC6Q", // Clean And Press
  "clean from blocks": "JVtuB8woFK0", // Cleans From Blocks
  "clean pull": "eMcNWP-0WJ4", // Clean Pull
  "close-grip barbell bench press": "bXUumc6mtDY", // Close-Grip Barbell Bench Press
  "close-grip ez bar curl": "S9LbjfGYLBQ", // Close-Grip EZ-Bar Curl
  "close-grip ez-bar curl with band": "mLQutC9ofHw", // Close-Grip EZ Bar Curl With Band
  "close-grip push-up off of a dumbbell": "mt9dTVNBbrQ", // Close-Grip Push-up Off Of A Dumbbell
  "close-grip standing barbell curl": "MLZxDHouma4", // Close-Grip Standing Barbell Curl
  cocoons: "_epVveGVTz8", // Cocoons
  "concentration curls": "vj3z4AetehE", // Concentration Curls
  "cross body hammer curl": "193aKGDmig4", // Cross Body Hammer Curls
  "cross-body crunch": "2b9EtcH771k", // Cross-Body Crunch
  crucifix: "jV_u23Z7bcE", // Crucifix
  crunch: "ZKw4t23ERuw",
  "crunch - hands overhead": "ey5fxii7i9U", // Crunch - Hands Overhead
  crunches: "jyL1ualF5uQ", // Crunches
  "cuban press": "bcdr6Hi3IBo", // Cuban Press
  "dead bug": "9JHV1uiGKzo", // Dead Bug
  deadlift: "ZaTM37cfiDs",
  "decline barbell bench press": "xfXBMGJUuUM", // Decline Barbell Bench Press
  "decline dumbbell bench press": "i5WZXKN23Po", // Decline Dumbbell Bench Press
  "decline dumbbell flyes": "dfqyhKb6MoA", // Decline Dumbbell Flyes
  "decline dumbbell triceps extension": "Qgs1GZOedmg", // Decline Dumbbell Tricep Extensions
  "decline ez bar triceps extension": "qTAqQd26arw", // Decline EZ-Bar Triceps Extension
  "decline oblique crunch": "jJ3_d0KBR6A", // Decline Oblique Crunch
  "decline push-up": "dEoTnCslFyw", // Decline Push-Ups
  "decline smith press": "e9gnZca2c68", // Decline Smith Press
  dip: "9llvBAV4RHI",
  "double kettlebell jerk": "dS-tFsbP6ro", // Double Kettlebell Jerk
  "double kettlebell push press": "BzWAtLL8bMM", // Double Kettlebell Push Press
  "double kettlebell snatch": "m5tLkPcBuFQ", // Double Kettlebell Snatch
  "double kettlebell windmill": "C1EsUjrTvyQ", // Double Kettlebell Windmill
  "dumbbell alternate bicep curl": "ESbTTLiC-4s", // Dumbbell Alternate Bicep Curl
  "dumbbell bench press": "Ujnj5zzENyI", // Dumbbell Bench Press
  "dumbbell bench press with neutral grip": "elGcGgwbpFw", // Dumbbell Bench Press with Neutral Grip
  "dumbbell bicep curl": "6tje5r0AAdA", // Dumbbell Bicep Curl
  "dumbbell clean": "R14DDDt-XFI", // Dumbbell Clean
  "dumbbell curl": "XE_pHwbst04",
  "dumbbell floor press": "Sc2WjvXmU88", // Dumbbell Floor Press
  "dumbbell flyes": "2imiSDyfV40", // Dumbbell Flyes
  "dumbbell incline row": "tojf5lFfcII", // Dumbbell Incline Row
  "dumbbell incline shoulder raise": "--JuKZkqeIE", // Dumbbell Incline Shoulder Raise
  "dumbbell lunges": "aU444npXJiM", // Dumbbell Lunges
  "dumbbell lying one-arm rear lateral raise": "wXjpoFWMCEY", // Dumbbell Lying One-Arm Rear Lateral Raise
  "dumbbell lying pronation": "eHcn_v2V_vM", // Dumbbell Lying Pronation
  "dumbbell lying rear lateral raise": "jjWC2mTS0sM", // Dumbbell Lying Rear Lateral Raise
  "dumbbell one-arm triceps extension": "QnXEXgSwj0M", // Dumbbell One-Arm Tricep Extension
  "dumbbell one-arm upright row": "5s2Me6HQLKQ", // Dumbbell One-Arm Upright Row
  "dumbbell prone incline curl": "Yi6XqFRMFXE", // Dumbbell Prone Incline Curl
  "dumbbell raise": "WE_LZJCPJa4", // Dumbbell Raise
  "dumbbell rear lunge": "i-Fqn7E1sLE", // Dumbbell Rear Lunge
  "dumbbell row": "gfUg6qWohTk",
  "dumbbell scaption": "m6NBpSBjPGs", // Dumbbell Scaption
  "dumbbell seated box jump": "uozrKs3YPAI", // Dumbbell Seated Box Jump
  "dumbbell shrug": "uYTK_H1bP6M", // Dumbbell Shrug
  "dumbbell side bend": "aGoEY539ceo", // Dumbbell Side Bend
  "dumbbell squat": "UEJSAStgt0g", // Dumbbell Squat
  "dumbbell squat to a bench": "S6gf5JkHMcY", // Dumbbell Squat To A Bench
  "dumbbell step ups": "JRrQpo8sKAU", // Dumbbell Step Ups
  "dynamic back stretch": "iWhJw5UQu48", // Dynamic Back Stretch
  "dynamic chest stretch": "nm4b32bZQEU", // Dynamic Chest Stretch
  "elevated cable rows": "3GEkyB9Ke2w", // Elevated Cable Rows
  "external rotation with band": "4axWmCx3lEw", // External Rotation With Bands
  "ez-bar curl": "sk9vId0r-7k", // EZ-Bar Curls
  "ez-bar skullcrusher": "7VyPqq_XIcQ", // EZ-Bar Skullcrushers
  "face pull": "rxBssTg6KSE", // Face Pulls
  "farmers walk": "olLjhmo694U", // Farmer's Walk
  "flat bench cable flyes": "GKeKE6NWm24", // Flat Bench Cable Flyes
  "flat bench leg pull-in": "8K5gY06FX1I", // Flat Bench Leg Pull In
  "flat bench lying leg raise": "hYh0O74RqrI", // Flat Bench Lying Leg Raise
  "flexor incline dumbbell curls": "aFdcalu6-c8", // Flexor Incline Dumbbell Curls
  "flutter kicks": "PWeFeJKwmoE", // Flutter Kicks
  "frankenstein squat": "GwKI0cuFlkE", // Frankenstein Squats
  "frog sit-ups": "WpmHAYhbfoI", // Frog Sit Ups
  "front cable raise": "qkcU7p_m4to", // Front Cable Raises
  "front incline dumbbell raise": "AbdHWZuYo_A", // Front Incline Dumbbell Raise
  "front plate raise": "UbO4CrbfV9c", // Front Plate Raise
  "front raise and pullover": "ulEbzaPy1Fo", // Front Raise and Pullover
  "front squat": "_qv0m3tPd3s",
  "full range-of-motion lat pulldown": "bNmvKpJSWKM",
  "gironda sternum chins": "u3m3amlgj5I", // Gironda Sternum Chins
  "goblet squat": "JN_ibGLbjxM", // Goblet Squat
  "good morning": "6-mJR5NvF3c", // Good Mornings
  "good morning off pins": "FubluSoLsmk", // Good Mornings Off Pins
  groiners: "p2jgaHa50PU", // Groiners
  "hammer curl": "TZUv6qhubas",
  "hang clean": "LLFo2TxLOLo", // Hang Cleans
  "hang clean - below the knees": "KzCB9mc6J2w", // Hang Clean - Below The Knees
  "hang snatch": "Eq7ZlBmFdhs", // Hang Snatch
  "hang snatch - below knees": "C5sxlM8qgBM", // Hang Snatch - Below The Knees
  "hanging leg raise": "rFE2T5CumXs", // Hanging Leg Raises
  "hanging pike": "W2bAqtQ_smM", // Hanging Pike
  "heaving snatch balance": "XzStZIFlvyI", // Heaving Snatch Balance
  "high cable curls": "GIROVVeVR4U", // High Cable Curls
  "hip circles (prone)": "3ilzqrFEkkY", // Hip Circles
  "hip extension with bands": "kUGSunBQqH0", // Hip Extension With Bands
  "hip flexion with band": "gbf5YBB5Nuo", // Hip Flexion With Bands
  "hip thrust": "5S8SApGU_Lk",
  "hyperextensions (back extensions)": "qSUpG1a7RMY", // Hyperextensions
  "incline cable chest press": "K88hDCAfjMU", // Incline Cable Chest Press
  "incline cable flye": "Y389PIcfs2A", // Incline Cable Flyes
  "incline dumbbell curl": "ouKnGRb043g", // Incline Dumbbell Curls
  "incline dumbbell flyes": "-ZV3ZmaIDrM", // Incline Dumbbell Flyes
  "incline dumbbell flyes - with a twist": "JcThMhNOKlw", // Incline Dumbbell Flyes With A Twist
  "incline dumbbell press": "d68OG1bgqVg", // Incline Dumbbell Press
  "incline hammer curls": "tK55JIavsC4", // Incline Hammer Curls
  "internal rotation with band": "Wq7DXZW4pHY", // Internal Rotation With Bands
  "iron cross": "SMr37HL5Zbc", // Iron Cross
  "jefferson squats": "wcfgi6fpLAg", // Jefferson Squat
  "jerk balance": "fjcQpFyHfAs", // Jerk Balance
  "jerk dip squat": "5rCKWWWJIq4", // Jerk Dip Squat
  "jogging, treadmill": "K6I24WgiiPw",
  "kettlebell arnold press": "BwYjlOl2fKI", // Kettlebell Arnold Press
  "kettlebell figure 8": "w0nXNiWjS6M", // Kettlebell Figure of 8
  "kettlebell pirate ships": "Q9t1xZRFnow", // Kettlebell Pirate Ships
  "kettlebell seesaw press": "GJ9mnv67J3c", // Kettlebell Seesaw Press
  "kettlebell sumo high pull": "paH0vS_96pc", // Kettlebell Sumo High Pull
  "kettlebell thruster": "gzCRD2MS4-s", // Kettlebell Thruster
  "kettlebell turkish get-up (lunge style)": "fNH_IZwSo4I", // Kettlebell Turkish Get Up
  "kettlebell turkish get-up (squat style)": "fNH_IZwSo4I", // Kettlebell Turkish Get Up
  "knee tuck jump": "6QMkWy7Dgao", // Knee Tuck Jumps
  "kneeling cable triceps extension": "h9udmN7RfKk", // Kneeling Cable Triceps Extension
  "kneeling high pulley row": "pfjmv8njdws", // Kneeling High Pulley Row
  "kneeling single-arm high pulley row": "83BT6B4v7T4", // Kneeling Single-Arm High Pulley Row
  "kneeling squat": "AmV5OLE0sB0", // Kneeling Squats
  "landmine 180s": "luYHqEgnXbk", // Landmine 180's
  "lat pulldown": "bNmvKpJSWKM",
  "lateral bound": "uFt_6R_iSm4", // Lateral Bounds
  "lateral raise": "Kl3LEzQ5Zqs",
  "lateral raise - with bands": "zdSueJ3JM-o", // Lateral Raises With Bands
  "leg curl": "_lgE0gPvbik",
  "leg extension": "ztNBgrGy6FQ",
  "leg extensions": "eMXR40gE044", // Leg Extensions
  "leg press": "7IjrQj2sxqA", // Leg Press
  "leg pull-in": "AH7uELjhyPI", // Leg Pull Ins
  "leverage decline chest press": "ouV5j9d4hfI", // Leverage Decline Chest Press
  "leverage incline chest press": "D45sO7jSebI", // Leverage Incline Chest Press
  "leverage iso row": "oSfBoTOSgQQ", // Leverage Iso Row
  "leverage shoulder press": "fKA6HtKGzW4", // Leverage Shoulder Press
  "log lift": "JpLG2zJBHg8", // Log Lift
  "low cable crossover": "e3FsvYvlXiY", // Low Cable Crossover
  "low cable triceps extension": "14FLeQKDGj8", // Low Cable Tricep Extension
  lunge: "mJilHWIBWO8",
  "lying cable curl": "fv2Iih_LoCw", // Lying Cable Curls
  "lying close-grip barbell triceps extension behind the head": "XPQziBbJVnI", // Lying Close-Grip Barbell Triceps Extension Behind The Head
  "lying close-grip barbell triceps press to chin": "EkLv3kFPxmY", // Lying Close-Grip Barbell Triceps Press To Chin
  "lying face down plate neck resistance": "jg3Q7bkabu4", // Lying Face Down Plate Neck Resistance
  "lying face up plate neck resistance": "__mHZwz1pzM", // Lying Face Up Plate Neck Resistance
  "lying high bench barbell curl": "HVgvZ4Xf70w", // Lying High Bench Barbell Curls
  "lying supine dumbbell curl": "n3MXFaGzg5U", // Lying Supine Dumbbell Curl
  "lying t-bar row": "EOFZfYZYAO8", // Lying T Bar Row
  "middle back shrug": "91-CcFKUxwQ", // Middle Back Shrug
  "mountain climber": "cnyTQDSE884",
  "mountain climbers": "8Av7DoAgxVU", // Mountain Climbers
  "narrow stance leg press": "S-gbYkOQ2mk", // Narrow Stance Leg Press
  "natural glute ham raise": "ifwSOKm9MCE", // Natural Glute Ham Raise
  "oblique crunches": "ABWPCPgquWw", // Oblique Crunches
  "one-arm flat bench dumbbell flye": "Bd2WnpZXwyI", // One-Arm Flat Bench Dumbbell Flye
  "one-arm incline lateral raise": "Mi_amGY2FAg", // One-Arm Incline Lateral Raise
  "one-arm kettlebell clean": "2laiD8ZjOtI", // One-Arm Kettlebell Clean
  "one-arm kettlebell clean and jerk": "cCR34yuHE0Q", // One-Arm Kettlebell Clean & Jerk
  "one-arm kettlebell floor press": "BFLrmiP_0rw", // One-Arm Kettlebell Floor Press
  "one-arm kettlebell jerk": "4adnKwoHJEg", // One-Arm Kettlebell Jerk
  "one-arm kettlebell para press": "wn1AfnU7bb8", // One-Arm Kettlebell Para Press
  "one-arm kettlebell push press": "i302wzAtEYo", // One-Arm Kettlebell Push Press
  "one-arm kettlebell row": "e8Yz6OM68DQ", // One-Arm Kettlebell Row
  "one-arm kettlebell snatch": "E_0VhqSTcXM", // One-Arm Kettlebell Snatch
  "one-arm kettlebell split jerk": "xoC_aBsawHM", // One-Arm Kettlebell Split Jerk
  "one-arm kettlebell split snatch": "Fv3A5RM0J5E", // One-Arm Kettlebell Split Snatch
  "one-arm kettlebell swings": "q2AVt-8MF54", // One-Arm Kettlebell Swings
  "one-arm overhead kettlebell squats": "XVw9jVEXEiM", // One-Arm Overhead Kettlebell Squats
  "one-legged cable kickback": "8bqi57dOO7U", // One-Legged Cable Kickback
  "otis-up": "vjAjAERSkIk", // Otis-Up
  "overhead cable curl": "AcEgxyKpcU8", // Overhead Cable Curls
  "overhead press": "zoN5EH50Dro",
  "overhead squat": "k4naFq89yb4", // Overhead Squat
  "pallof press": "rts4oLM6lGs", // Pallof Press
  "pallof press with rotation": "HRiKIeyIByw", // Pallof Press With Rotation
  "palms-down dumbbell wrist curl over a bench": "jtQslxR3f0A", // Palms-Down Dumbbell Wrist Curl Over a Bench
  "palms-up barbell wrist curl over a bench": "UplU1tgNadQ", // Palms Up Barbell Wrist Curls Over A Bench
  "palms-up dumbbell wrist curl over a bench": "VqN3IEJJ33A", // Palms-Up Dumbbell Wrist Curl Over a Bench
  "parallel bar dip": "Rog13igE8I0", // Parallel Bar Dips
  "pin presses": "J7CWO1X8r7Q", // Pin Presses
  plank: "Zzg5Z-j0Sho", // Plank
  "plate pinch": "QYVMUGtHWe4", // Plate Pinch
  "plate twist": "5m5z6ZZhz04", // Plate Twist
  "plie dumbbell squat": "5PspbqKP7S8", // Plie Dumbbell Squat
  "plyo kettlebell pushups": "hw14FbggBy4", // Plyo Kettlebell Push-Ups
  "power clean from blocks": "oqa4d4e5W-Q", // Power Cleans From Blocks
  "power jerk": "C8HNgSjsUzA", // Power Jerk
  "power snatch": "i1EKpyahAZI", // Power Snatch
  "power snatch from blocks": "PBGfwmFrZPE", // Power Snatch From Blocks
  "press sit-up": "VRlWN3qarTo", // Press Sit-Up
  "pull up": "eGo4IYlbE5g",
  pullups: "__9ocWQapAk", // Pull-Ups (Wide Grip)
  "push press": "jjmHMGJrOFE", // Push Press (Behind The Neck)
  "push up": "_YrJc-kTYA0",
  "push up to side plank": "gjeXEwSS0b4", // Push Up To Side Plank
  pushups: "_YrJc-kTYA0",
  "rack pulls": "jiF2sZx1PYk", // Rack Pulls
  "recumbent bike": "y-PPIpPv124", // Recumbent Bike
  "reverse barbell curl": "Yo0hHjvfdQI", // Reverse Barbell Curl
  "reverse barbell preacher curls": "2c8VlnmZuyI", // Reverse Barbell Preacher Curls
  "reverse cable curl": "nhRWOQZtvoY", // Reverse Cable Curl
  "reverse crunch": "HuaW4wOgDZU", // Reverse Crunch
  "reverse grip triceps pushdown": "MfxVKZn8tL8", // Reverse Grip Triceps Pushdown
  "reverse plate curls": "-pu02WL_ID0", // Reverse Plate Curls
  "ring dips": "PJXkw1ZwjQk", // Ring Dips
  "romanian deadlift": "5rIqP63yWFg",
  "rope climb": "6y4K-zrgfNU", // Rope Climb
  "rope straight-arm pulldown": "GOYikbtya6U", // Rope Straight Arm Pulldown
  "russian twist": "wkD8rjkodUI",
  "scapular pull-up": "NyHE9NPR3Qo", // Scapular Pull-Up
  "scissor kick": "DP9gjA82WdY", // Scissor Kicks
  "seated barbell military press": "3Dh4XKNLJ4Y", // Seated Barbell Military Press
  "seated barbell twist": "hrBeYnV__ms", // Seated Barbell Twist
  "seated bent-over rear delt raise": "_v9veeGbm34", // Seated Bent Over Rear Delt Raise
  "seated cable rows": "9AODjutglP4", // Seated Cable Rows
  "seated cable shoulder press": "wxe9JDl67Yg", // Seated Cable Shoulder Press
  "seated close-grip concentration barbell curl": "jB20Rj6VqYw", // Seated Close-Grip Concentration Barbell Curl
  "seated dumbbell curl": "dVzHa7U4oQ4", // Seated Dumbbell Curl
  "seated dumbbell inner biceps curl": "g5p99Lwskk4", // Seated Dumbbell Inner Bicep Curls
  "seated dumbbell palms-down wrist curl": "PDHxebi2vDQ", // Seated Dumbbell Palms-Down Wrist Curl
  "seated dumbbell palms-up wrist curl": "3rsKOL8scsU", // Seated Dumbbell Palms-Up Wrist Curl
  "seated good mornings": "Z332GMp5sy8", // Seated Good Mornings
  "seated leg curl": "joImLSPyQWQ", // Seated Leg Curl
  "see-saw press (alternating side press)": "DFzg2wdoEX8", // See-Saw Press
  "shotgun row": "UWK2XrUMjyw", // Shotgun Row
  "shoulder circles": "gHdck9mOQjA", // Shoulder Circles
  "shoulder press": "k6tzKisR3NY",
  "side bridge": "OGtRZ4vP7cI", // Side Bridges
  "side jackknife": "eLUSfdbxvF8", // Side Jackknife
  "single leg butt kick": "lGfI2026J94", // Single Leg Butt Kick
  "single leg glute bridge": "3kyAjM5mv3I", // Single Leg Glute Bridge
  "single-arm cable crossover": "Ob5vbpJShKU", // Single Arm Cable Crossover
  "single-arm linear jammer": "FkG27LeonTQ", // Single-Arm Linear Jammer
  "single-leg leg extension": "Gbl7lNosPTE", // Single-Leg Leg Extension
  "sit-up": "tgLGG1WeJxU", // Sit Ups
  "sled overhead triceps extension": "6gNGbIjSj8g", // Sled Overhead Tricep Extensions
  "sled push": "2-sosJs_VQk", // Sled Push
  "sled reverse flye": "Wo7jivak5Yg", // Sled Reverse Flyes
  "sled row": "DWWZDkbaLlQ", // Sled Rows
  "sledgehammer swings": "D4__VB-z3C8", // Sledgehammer Swings
  "smith machine bench press": "dkcyeKCHThU", // Smith Machine Bench Press
  "smith machine bent over row": "1hpB2fqQDYQ", // Smith Machine Bent Over Row
  "smith machine calf raise": "zc9j5nyZSq4", // Smith Machine Calf Raises
  "smith machine close-grip bench press": "Y3WiRgIJpcM", // Smith Machine Close-Grip Bench Press
  "smith machine hang power clean": "YjxK7RppzIM", // Smith Machine Hang Power Clean
  "smith machine hip raise": "n2GP6ZrRayw", // Smith Machine Hip Raises
  "smith machine incline bench press": "wr9kXwNoutY", // Smith Machine Incline Bench Press
  "smith machine leg press": "Y9FD9qt7RwM", // Smith Machine Leg Press
  "smith machine one-arm upright row": "Ycr-mcU0rMc", // Smith Machine One-Arm Upright Row
  "smith machine pistol squat": "54_6u4vjEvU", // Smith Machine Pistol Squats
  "smith machine reverse calf raises": "y_HYoKh7LJA", // Smith Machine Reverse Calf Raises
  "smith machine squat": "O1_4vksXI5o", // Smith Machine Squat
  "smith machine stiff-legged deadlift": "ujU5agZzMUk", // Smith Machine Stiff-Legged Deadlift
  "smith machine upright row": "AweCTlMLVWU", // Smith Machine Upright Row
  "snatch balance": "NGlBxkvJPnE", // Snatch Balance
  "snatch from blocks": "SFC6xwRsjmw", // Snatch From Blocks
  "snatch shrug": "N9ZwZedRrac", // Snatch Shrug
  "spell caster": "RP09o5x2jAk", // Spell Caster
  "split clean": "Zr7DpXmpD_g", // Split Clean
  "split jerk": "TGHdmx7GThs", // Split Jerk
  "split snatch": "6lMRyPs2ZC8", // Split Snatch
  "split squat with dumbbells": "Oal90jVJkyQ", // Split Squat with Dumbbells
  squat: "rrJIyZGlK8c",
  "squat jerk": "Pmey7_tyvQ4", // Squat Jerk
  "standing alternating dumbbell press": "I25p_PYgCno", // Standing Alternating Dumbbell Press
  "standing barbell press behind neck": "dxRxbOegFYA", // Standing Barbell Press Behind The Neck
  "standing concentration curl": "cNfK6er95jU", // Standing Concentration Curl
  "standing dumbbell calf raise": "L-Un0hv6xho", // Standing Dumbbell Calf Raise
  "standing dumbbell press": "d2TdOcXPi2E", // Standing (Palms In) Dumbbell Press
  "standing dumbbell reverse curl": "DpGClEEL2mo", // Standing Dumbbell Reverse Curl
  "standing dumbbell straight-arm front delt raise above head": "Uoe-LgnoaeU", // Standing Dumbbell Straight-Arm Front Delt Raise Above Head
  "standing dumbbell triceps extension": "5N7-2HarPDc", // Standing Dumbbell Tricep Extension
  "standing hip circles": "J99HfZjMzL8", // Standing Hip Circles
  "standing low-pulley deltoid raise": "6wLViZHJPcM", // Standing Low-Pulley Deltoid Raise
  "standing low-pulley one-arm triceps extension": "PIBTRNvE6_M", // Standing Low-Pulley One-Arm Tricep Extension
  "standing one-arm cable curl": "gEdWELfWZcc", // Standing One-Arm Cable Curl
  "standing one-arm dumbbell triceps extension": "Faou3M95lSE", // Standing One-Arm Dumbbell Tricep Extension
  "standing overhead barbell triceps extension": "WWNudadvFzg", // Standing Overhead Barbell Triceps Extension
  "standing pelvic tilt": "WNsIpNr3kFE", // Standing Pelvic Tilt
  "standing rope crunch": "am0Yizgp_D0", // Standing Rope Crunch
  "star jump": "R_pczc0y1TI", // Star Jumps
  "step mill": "cCaQjmzjHNo", // Step Mill
  "step-up with knee raise": "P_Pp7aRTau0", // Step Up With Knee Raise
  "sumo deadlift": "89yp_n1Ljvc", // Sumo Deadlift
  "sumo deadlift with bands": "9_C6O4CynVg", // Sumo Deadlifts With Bands
  "svend press": "rRToJYNADgA", // Svend Press
  "tate press": "Er-UcoSOA90", // Tate Press
  "toe touchers": "v-FBXufN91Y", // Toe-Touchers
  "triceps pushdown": "1FjkhpZsaxc",
  "two-arm dumbbell preacher curl": "EEStsiL9sG8", // Two Arm Dumbbell Preacher Curl
  "two-arm kettlebell military press": "ioD3Q6d9PSk", // Two-Arm Kettlebell Military Press
  "underhand cable pulldowns": "ENeMdS7iEjM", // Underhand Cable Pulldowns
  "upright barbell row": "v39_bcqzRvU", // Upright Barbell Row
  "upright cable row": "4kyqAHkx_BY", // Upright Cable Row
  "v-bar pulldown": "gR5uvo-1a2U", // V-Bar Pulldown
  "v-bar pullup": "kAAuh1-SxXw", // V-Bar Pullups
  "weighted crunches": "GJDnTnCXpeA", // Weighted Crunches
  "weighted pull ups": "PC76k5VfPss", // Weighted Pull Ups
  "weighted sissy squat": "hOdsVKmHlGs", // Weighted Sissy Squats
  "wide-grip decline barbell pullover": "VZrgXy-aySE", // Wide Grip Decline Barbell Pullover
  "wide-grip lat pulldown": "2x9E_reM8cU", // Wide Grip Lat Pulldown
  "wide-grip standing barbell curl": "45fzrpviouw", // Wide-Grip Standing Barbell Curl
  windmills: "cnPJ4KEshek", // Windmills
  "worlds greatest stretch": "jsP64UZVG9M", // World's Greatest Stretch
  "yoke walk": "WczWq01jYBQ", // Yoke Walk
  "zercher squats": "B-5n0aCXaAU", // Zercher Squat
  "zottman curl": "05YHYzFXK8o", // Zottman Curl
  "zottman preacher curl": "prfNS4YiAqU", // Zottman Preacher Curls
};

// Longest keys first so a specific match (e.g. "romanian deadlift") wins over a
// more generic one ("deadlift") during substring lookup.
const SORTED_KEYS = Object.keys(EXERCISE_VIDEOS).sort((a, b) => b.length - a.length);

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolves an exercise name to a curated YouTube video ID, or null if none is
 * mapped. Tries an exact normalized match first, then a substring/alias match
 * (e.g. "Dumbbell Bench Press" → "bench press", "Barbell Hip Thrust" → "hip thrust").
 */
export function getExerciseVideoId(name: string | undefined | null): string | null {
  const n = normalize(name ?? "");
  if (!n) return null;
  if (EXERCISE_VIDEOS[n]) return EXERCISE_VIDEOS[n];
  for (const key of SORTED_KEYS) {
    if (n.includes(key)) return EXERCISE_VIDEOS[key];
  }
  return null;
}
