-- =============================================================
-- 20260422_004_seed_ingredient_catalog.sql
--
-- Lean v1 Indian ingredient catalog (~150 rows).
-- Covers: whole + ground spices, herbs, dals, beans, grains,
-- flours, vegetables, leafy greens, fruits, dairy, meat/seafood,
-- oils, nuts/seeds, sweeteners, acids, pastes, condiments,
-- leaveners.
--
-- Re-runnable via ON CONFLICT DO NOTHING on canonical_id.
-- is_staple = true for items the LLM should strongly anchor on.
-- Aliases include Hindi/regional names where common (dhania,
-- haldi, methi, kothmir, etc.) so pantry/shopping matching can
-- normalise user input later.
-- =============================================================

BEGIN;

INSERT INTO ingredient_catalog (canonical_id, display_name, category, unit_default, aliases, is_staple, verified) VALUES

-- ─── WHOLE SPICES ──────────────────────────────────────────────
('cumin_seeds',        'Cumin Seeds',        'spice_whole', 'teaspoon', ARRAY['jeera','zeera','sabut jeera'],                 true,  true),
('mustard_seeds',      'Mustard Seeds',      'spice_whole', 'teaspoon', ARRAY['rai','sarson','kadugu','black mustard seeds'], true,  true),
('coriander_seeds',    'Coriander Seeds',    'spice_whole', 'teaspoon', ARRAY['sabut dhania','dhania seeds'],                 false, true),
('fennel_seeds',       'Fennel Seeds',       'spice_whole', 'teaspoon', ARRAY['saunf','sompu'],                               false, true),
('fenugreek_seeds',    'Fenugreek Seeds',    'spice_whole', 'teaspoon', ARRAY['methi seeds','methi dana','venthayam'],        false, true),
('carom_seeds',        'Carom Seeds',        'spice_whole', 'teaspoon', ARRAY['ajwain','omam','bishop''s weed'],              false, true),
('nigella_seeds',      'Nigella Seeds',      'spice_whole', 'teaspoon', ARRAY['kalonji','black onion seeds'],                 false, true),
('black_peppercorns',  'Black Peppercorns',  'spice_whole', 'teaspoon', ARRAY['sabut kali mirch','whole black pepper'],       true,  true),
('green_cardamom',     'Green Cardamom',     'spice_whole', 'piece',    ARRAY['elaichi','choti elaichi','hari elaichi'],      true,  true),
('black_cardamom',     'Black Cardamom',     'spice_whole', 'piece',    ARRAY['badi elaichi','kali elaichi'],                 false, true),
('cloves',             'Cloves',             'spice_whole', 'piece',    ARRAY['laung','lavang','krambu'],                     true,  true),
('cinnamon_stick',     'Cinnamon Stick',     'spice_whole', 'piece',    ARRAY['dalchini','pattai'],                           true,  true),
('bay_leaf',           'Bay Leaf',           'spice_whole', 'piece',    ARRAY['tej patta','tamalpatra'],                      true,  true),
('star_anise',         'Star Anise',         'spice_whole', 'piece',    ARRAY['chakra phool','badiyan'],                      false, true),
('mace',               'Mace',               'spice_whole', 'piece',    ARRAY['javitri'],                                     false, true),
('nutmeg',             'Nutmeg',             'spice_whole', 'piece',    ARRAY['jaiphal','jaypatri'],                           false, true),
('dried_red_chili',    'Dried Red Chili',    'spice_whole', 'piece',    ARRAY['sukhi lal mirch','byadgi chili','kashmiri chili whole'], true, true),

-- ─── GROUND SPICES ─────────────────────────────────────────────
('turmeric_powder',    'Turmeric Powder',    'spice_ground', 'teaspoon', ARRAY['haldi','haldi powder','manjal'],               true,  true),
('red_chili_powder',   'Red Chili Powder',   'spice_ground', 'teaspoon', ARRAY['lal mirch powder','mirchi powder'],            true,  true),
('kashmiri_chili_powder','Kashmiri Chili Powder','spice_ground','teaspoon', ARRAY['kashmiri lal mirch','deggi mirch'],         true,  true),
('coriander_powder',   'Coriander Powder',   'spice_ground', 'teaspoon', ARRAY['dhania powder','pisa dhania'],                 true,  true),
('cumin_powder',       'Cumin Powder',       'spice_ground', 'teaspoon', ARRAY['jeera powder','pisa jeera'],                   true,  true),
('garam_masala',       'Garam Masala',       'spice_ground', 'teaspoon', ARRAY[]::text[],                                      true,  true),
('chaat_masala',       'Chaat Masala',       'spice_ground', 'teaspoon', ARRAY[]::text[],                                      false, true),
('sambar_powder',      'Sambar Powder',      'spice_ground', 'teaspoon', ARRAY['sambar masala'],                               false, true),
('rasam_powder',       'Rasam Powder',       'spice_ground', 'teaspoon', ARRAY['rasam masala'],                                false, true),
('pav_bhaji_masala',   'Pav Bhaji Masala',   'spice_ground', 'teaspoon', ARRAY[]::text[],                                      false, true),
('biryani_masala',     'Biryani Masala',     'spice_ground', 'teaspoon', ARRAY[]::text[],                                      false, true),
('kitchen_king_masala','Kitchen King Masala','spice_ground', 'teaspoon', ARRAY[]::text[],                                      false, true),
('kasuri_methi',       'Kasuri Methi',       'spice_ground', 'teaspoon', ARRAY['dried fenugreek leaves','dried methi'],        true,  true),
('amchur_powder',      'Amchur Powder',      'spice_ground', 'teaspoon', ARRAY['dry mango powder','aamchoor'],                 false, true),
('black_salt',         'Black Salt',         'spice_ground', 'teaspoon', ARRAY['kala namak','sanchal'],                        false, true),
('black_pepper_powder','Black Pepper Powder','spice_ground', 'teaspoon', ARRAY['pisi kali mirch','milagu podi'],               true,  true),
('asafoetida',         'Asafoetida',         'spice_ground', 'pinch',    ARRAY['hing','perungayam'],                           true,  true),
('turmeric_fresh',     'Fresh Turmeric',     'spice_ground', 'inch',     ARRAY['kachi haldi','manjal fresh'],                  false, true),

-- ─── FRESH HERBS ───────────────────────────────────────────────
('coriander_leaves',   'Coriander Leaves',   'herb_fresh',  'tablespoon', ARRAY['dhania','kothmir','hara dhania','cilantro'],  true,  true),
('mint_leaves',        'Mint Leaves',        'herb_fresh',  'tablespoon', ARRAY['pudina','pudina leaves'],                     true,  true),
('curry_leaves',       'Curry Leaves',       'herb_fresh',  'piece',      ARRAY['kadi patta','karivepillai','meetha neem'],    true,  true),
('fenugreek_leaves',   'Fresh Fenugreek Leaves','herb_fresh','cup',       ARRAY['methi','methi leaves','hari methi'],          false, true),
('dill_leaves',        'Dill Leaves',        'herb_fresh',  'tablespoon', ARRAY['sua bhaji','sowa','suva'],                    false, true),

-- ─── LENTILS (DAL) ─────────────────────────────────────────────
('toor_dal',           'Toor Dal',           'lentil',      'cup', ARRAY['arhar dal','tuvar dal','pigeon pea','split pigeon pea'], true, true),
('moong_dal',          'Moong Dal',          'lentil',      'cup', ARRAY['yellow moong','split green gram','pesara pappu'],    true,  true),
('whole_moong',        'Whole Green Moong',  'lentil',      'cup', ARRAY['sabut moong','whole green gram','pachai payaru'],    false, true),
('masoor_dal',         'Masoor Dal',         'lentil',      'cup', ARRAY['red lentils','split red lentils'],                   true,  true),
('whole_masoor',       'Whole Brown Lentils','lentil',      'cup', ARRAY['sabut masoor','kali masoor'],                        false, true),
('chana_dal',          'Chana Dal',          'lentil',      'cup', ARRAY['split bengal gram','senaga pappu'],                  true,  true),
('urad_dal',           'Urad Dal',           'lentil',      'cup', ARRAY['split black gram','minapa pappu','white urad dal'],  true,  true),
('urad_whole',         'Whole Black Urad',   'lentil',      'cup', ARRAY['sabut urad','kali dal'],                             false, true),
('horse_gram',         'Horse Gram',         'lentil',      'cup', ARRAY['kulthi','kollu','ulavalu'],                          false, true),

-- ─── BEANS ─────────────────────────────────────────────────────
('chickpeas',          'Chickpeas',          'bean',        'cup', ARRAY['kabuli chana','white chana','garbanzo beans'],       true,  true),
('black_chickpeas',    'Black Chickpeas',    'bean',        'cup', ARRAY['kala chana','desi chana'],                           false, true),
('rajma',              'Kidney Beans',       'bean',        'cup', ARRAY['rajma','red kidney beans','laal rajma'],             true,  true),
('rajma_chitra',       'Chitra Kidney Beans','bean',        'cup', ARRAY['chitra rajma','speckled kidney beans'],              false, true),
('black_eyed_peas',    'Black-Eyed Peas',    'bean',        'cup', ARRAY['lobia','chawli','karamani'],                         false, true),
('green_peas_dried',   'Dried Green Peas',   'bean',        'cup', ARRAY['sukhi matar','vatana','dried peas'],                 false, true),
('white_peas_dried',   'Dried White Peas',   'bean',        'cup', ARRAY['safed matar','safed vatana'],                        false, true),
('moth_beans',         'Moth Beans',         'bean',        'cup', ARRAY['matki','dew beans'],                                 false, true),

-- ─── GRAINS ────────────────────────────────────────────────────
('basmati_rice',       'Basmati Rice',       'grain',       'cup', ARRAY['long grain basmati','chawal'],                       true,  true),
('sona_masoori_rice',  'Sona Masoori Rice',  'grain',       'cup', ARRAY['sona masuri'],                                       true,  true),
('parboiled_rice',     'Parboiled Rice',     'grain',       'cup', ARRAY['ukda chawal','idli rice'],                           false, true),
('poha',               'Flattened Rice',     'grain',       'cup', ARRAY['poha','aval','chivda','atukulu','beaten rice'],      true,  true),
('puffed_rice',        'Puffed Rice',        'grain',       'cup', ARRAY['murmura','mamra','kurmura','pori'],                  false, true),
('broken_wheat',       'Broken Wheat',       'grain',       'cup', ARRAY['dalia','lapsi','cracked wheat'],                     false, true),
('semolina',           'Semolina',           'grain',       'cup', ARRAY['sooji','rava','suji'],                               true,  true),
('oats',               'Rolled Oats',        'grain',       'cup', ARRAY['oats','rolled oats','jai'],                          false, true),

-- ─── FLOURS ────────────────────────────────────────────────────
('atta',               'Whole Wheat Flour',  'flour',       'cup', ARRAY['atta','gehu ka atta','whole wheat flour','chapati atta'], true, true),
('maida',              'All-Purpose Flour',  'flour',       'cup', ARRAY['maida','plain flour','refined flour'],               true,  true),
('besan',              'Gram Flour',         'flour',       'cup', ARRAY['besan','chickpea flour','chana atta','senagapindi'], true,  true),
('rice_flour',         'Rice Flour',         'flour',       'cup', ARRAY['chawal ka atta','biyyam pindi'],                     false, true),
('bajra_flour',        'Pearl Millet Flour', 'flour',       'cup', ARRAY['bajra atta','bajri atta','sajjalu pindi'],           false, true),
('jowar_flour',        'Sorghum Flour',      'flour',       'cup', ARRAY['jowar atta','jonna pindi'],                          false, true),
('ragi_flour',         'Finger Millet Flour','flour',       'cup', ARRAY['ragi atta','nachni atta'],                           false, true),
('makki_atta',         'Corn Flour (Coarse)','flour',       'cup', ARRAY['makki ka atta','corn meal','coarse cornmeal'],       false, true),
('corn_starch',        'Cornstarch',         'flour',       'tablespoon', ARRAY['corn flour','makki starch'],                   false, true),

-- ─── VEGETABLES ────────────────────────────────────────────────
('onion',              'Onion',              'vegetable',   'piece', ARRAY['pyaz','kanda','ulli','pyaaz'],                      true,  true),
('red_onion',          'Red Onion',          'vegetable',   'piece', ARRAY['laal pyaz'],                                       false, true),
('tomato',             'Tomato',             'vegetable',   'piece', ARRAY['tamatar','thakkali'],                               true,  true),
('potato',             'Potato',             'vegetable',   'piece', ARRAY['aloo','batata','alu'],                              true,  true),
('ginger',             'Ginger',             'vegetable',   'inch',  ARRAY['adrak','inji'],                                    true,  true),
('garlic',             'Garlic',             'vegetable',   'clove', ARRAY['lehsun','vellulli'],                                true,  true),
('green_chili',        'Green Chili',        'vegetable',   'piece', ARRAY['hari mirch','pacha mirapakaya'],                   true,  true),
('cauliflower',        'Cauliflower',        'vegetable',   'piece', ARRAY['phool gobhi','gobi'],                               false, true),
('cabbage',            'Cabbage',            'vegetable',   'piece', ARRAY['patta gobhi','band gobhi'],                         false, true),
('carrot',             'Carrot',             'vegetable',   'piece', ARRAY['gajar'],                                           false, true),
('beetroot',           'Beetroot',           'vegetable',   'piece', ARRAY['chukandar'],                                       false, true),
('capsicum',           'Capsicum',           'vegetable',   'piece', ARRAY['shimla mirch','bell pepper'],                       false, true),
('green_beans',        'Green Beans',        'vegetable',   'cup',   ARRAY['french beans','fansi','beans'],                    false, true),
('okra',               'Okra',               'vegetable',   'cup',   ARRAY['bhindi','lady finger','bendakaya'],                 false, true),
('bottle_gourd',       'Bottle Gourd',       'vegetable',   'piece', ARRAY['lauki','doodhi','sorakaya','ghiya'],                false, true),
('ridge_gourd',        'Ridge Gourd',        'vegetable',   'piece', ARRAY['turai','beerakaya','jhinge'],                       false, true),
('bitter_gourd',       'Bitter Gourd',       'vegetable',   'piece', ARRAY['karela','kakarakaya'],                              false, true),
('ash_gourd',          'Ash Gourd',          'vegetable',   'piece', ARRAY['petha','white pumpkin','kumbalanga'],               false, true),
('pumpkin',            'Pumpkin',            'vegetable',   'cup',   ARRAY['kaddu','sitaphal'],                                false, true),
('eggplant',           'Eggplant',           'vegetable',   'piece', ARRAY['baingan','brinjal','vankaya','kathirikkai'],        false, true),
('drumstick',          'Drumstick',          'vegetable',   'piece', ARRAY['moringa','sehjan','munagakaya'],                    false, true),
('raw_banana',         'Raw Banana',         'vegetable',   'piece', ARRAY['kaccha kela','aratikaya','plantain'],               false, true),
('yam',                'Yam',                'vegetable',   'cup',   ARRAY['suran','jimikand','elephant foot yam'],             false, true),
('sweet_potato',       'Sweet Potato',       'vegetable',   'piece', ARRAY['shakarkandi','genasu'],                             false, true),
('cucumber',           'Cucumber',           'vegetable',   'piece', ARRAY['kheera','khira','kakdi'],                           false, true),
('radish',             'Radish',             'vegetable',   'piece', ARRAY['mooli','muli'],                                    false, true),
('mushroom',           'Mushroom',           'vegetable',   'cup',   ARRAY['khumb','dhingri'],                                 false, true),
('corn_kernels',       'Corn Kernels',       'vegetable',   'cup',   ARRAY['makka','bhutta','sweet corn'],                     false, true),

-- ─── LEAFY GREENS ──────────────────────────────────────────────
('spinach',            'Spinach',            'leafy_green', 'cup', ARRAY['palak','palakura'],                                   true,  true),
('amaranth_leaves',    'Amaranth Leaves',    'leafy_green', 'cup', ARRAY['chaulai','thotakura','lal saag'],                    false, true),
('fenugreek_greens',   'Fenugreek Greens',   'leafy_green', 'cup', ARRAY['methi saag','hari methi bhaji'],                     false, true),
('mustard_greens',     'Mustard Greens',     'leafy_green', 'cup', ARRAY['sarson','sarson saag'],                              false, true),
('bathua',             'Lamb''s Quarters',   'leafy_green', 'cup', ARRAY['bathua','bathua saag'],                              false, true),

-- ─── FRUITS ────────────────────────────────────────────────────
('lemon',              'Lemon',              'fruit',       'piece', ARRAY['nimbu','limbu','elumichai'],                        true,  true),
('lime',               'Lime',               'fruit',       'piece', ARRAY['kagzi nimbu','sweet lime'],                        false, true),
('raw_mango',          'Raw Mango',          'fruit',       'piece', ARRAY['kacchi keri','mamidikaya'],                        false, true),
('banana',             'Banana',             'fruit',       'piece', ARRAY['kela'],                                            false, true),
('coconut_fresh',      'Fresh Coconut',      'fruit',       'cup',   ARRAY['nariyal','kobbari','thengai','fresh grated coconut'], true, true),
('pomegranate_seeds',  'Pomegranate Seeds',  'fruit',       'cup',   ARRAY['anardana fresh','anar'],                           false, true),
('tamarind',           'Tamarind',           'fruit',       'tablespoon', ARRAY['imli','chintapandu','puli'],                  true,  true),

-- ─── DAIRY ─────────────────────────────────────────────────────
('milk',               'Milk',               'dairy',       'cup',    ARRAY['doodh','paalu'],                                  true,  true),
('yogurt',             'Yogurt',             'dairy',       'cup',    ARRAY['dahi','curd','thayir','perugu'],                  true,  true),
('butter',             'Butter',             'dairy',       'tablespoon', ARRAY['makhan','butter unsalted'],                  true,  true),
('ghee',               'Ghee',               'oil_fat',     'tablespoon', ARRAY['desi ghee','clarified butter'],               true,  true),
('heavy_cream',        'Heavy Cream',        'dairy',       'tablespoon', ARRAY['malai','fresh cream','cream'],                false, true),
('paneer',             'Paneer',             'paneer_tofu', 'gram',   ARRAY['cottage cheese','homemade paneer'],                true,  true),
('khoya',              'Khoya',              'dairy',       'cup',    ARRAY['mawa','khoa'],                                    false, true),
('condensed_milk',     'Condensed Milk',     'dairy',       'cup',    ARRAY['milkmaid'],                                       false, true),

-- ─── MEAT / SEAFOOD / EGG ──────────────────────────────────────
('chicken',            'Chicken',            'meat',        'gram', ARRAY['chicken breast','chicken pieces','murgh'],          false, true),
('mutton',             'Mutton',             'meat',        'gram', ARRAY['goat meat','bakri ka gosht'],                       false, true),
('prawns',             'Prawns',             'seafood',     'gram', ARRAY['shrimp','jhinga','chingri'],                        false, true),
('fish_fillet',        'Fish Fillet',        'seafood',     'gram', ARRAY['machli','mach','rohu','pomfret'],                   false, true),
('egg',                'Egg',                'egg',         'piece', ARRAY['anda','eggs'],                                     true,  true),

-- ─── OILS / FATS ───────────────────────────────────────────────
('sunflower_oil',      'Sunflower Oil',      'oil_fat',     'tablespoon', ARRAY['refined oil','cooking oil'],                  true,  true),
('mustard_oil',        'Mustard Oil',        'oil_fat',     'tablespoon', ARRAY['sarson ka tel','kachi ghani'],                false, true),
('coconut_oil',        'Coconut Oil',        'oil_fat',     'tablespoon', ARRAY['nariyal tel'],                                false, true),
('sesame_oil',         'Sesame Oil',         'oil_fat',     'tablespoon', ARRAY['til tel','gingelly oil','nalla nuvvula nune'],false, true),
('peanut_oil',         'Peanut Oil',         'oil_fat',     'tablespoon', ARRAY['groundnut oil','moongphali tel'],             false, true),
('vegetable_oil',      'Vegetable Oil',      'oil_fat',     'tablespoon', ARRAY['oil','neutral oil'],                          true,  true),

-- ─── NUTS / SEEDS ──────────────────────────────────────────────
('cashew',             'Cashew',             'nut_seed',    'cup', ARRAY['kaju','kaju nuts'],                                   true,  true),
('almond',             'Almond',             'nut_seed',    'cup', ARRAY['badam'],                                             false, true),
('peanut',             'Peanut',             'nut_seed',    'cup', ARRAY['moongphali','groundnut','pallelu'],                  true,  true),
('pistachio',          'Pistachio',          'nut_seed',    'cup', ARRAY['pista'],                                             false, true),
('walnut',             'Walnut',             'nut_seed',    'cup', ARRAY['akhrot'],                                            false, true),
('raisins',            'Raisins',            'dried_fruit', 'tablespoon', ARRAY['kishmish','black raisins','golden raisins'],  false, true),
('dates',              'Dates',              'dried_fruit', 'piece', ARRAY['khajur','kharjur'],                                false, true),
('sesame_seeds',       'Sesame Seeds',       'nut_seed',    'tablespoon', ARRAY['til','ellu','nuvvulu'],                       false, true),
('poppy_seeds',        'Poppy Seeds',        'nut_seed',    'tablespoon', ARRAY['khus khus','posto'],                          false, true),
('melon_seeds',        'Melon Seeds',        'nut_seed',    'tablespoon', ARRAY['magaz','charmagaz'],                          false, true),

-- ─── SWEETENERS ────────────────────────────────────────────────
('sugar',              'Sugar',              'sweetener',   'teaspoon', ARRAY['shakkar','chini','cheeni'],                      true,  true),
('jaggery',            'Jaggery',            'sweetener',   'tablespoon', ARRAY['gud','gur','bellam','vellam'],                true,  true),
('honey',              'Honey',              'sweetener',   'tablespoon', ARRAY['shehad','madh'],                              false, true),
('brown_sugar',        'Brown Sugar',        'sweetener',   'teaspoon', ARRAY['demerara sugar'],                               false, true),

-- ─── SALT / ACIDS ──────────────────────────────────────────────
('salt',               'Salt',               'salt',        'teaspoon', ARRAY['namak','uppu','sea salt','common salt'],         true,  true),
('rock_salt',          'Rock Salt',          'salt',        'teaspoon', ARRAY['sendha namak','himalayan pink salt'],           false, true),
('tamarind_paste',     'Tamarind Paste',     'acid',        'tablespoon', ARRAY['imli paste','imli pulp','tamarind pulp'],     true,  true),
('kokum',              'Kokum',              'acid',        'piece', ARRAY['amsul','kokum fruit'],                              false, true),
('dried_mango_slices', 'Dried Mango Slices', 'acid',        'piece', ARRAY['aamchoor slices','sun-dried mango'],                false, true),

-- ─── PASTES / COMPOUNDS ────────────────────────────────────────
('ginger_garlic_paste','Ginger-Garlic Paste','paste_compound', 'teaspoon', ARRAY['adrak lehsun paste','GG paste'],              true,  true),
('green_chili_paste',  'Green Chili Paste',  'paste_compound', 'teaspoon', ARRAY['hari mirch paste'],                          false, true),
('red_chili_paste',    'Red Chili Paste',    'paste_compound', 'teaspoon', ARRAY['lal mirch paste'],                           false, true),
('cashew_paste',       'Cashew Paste',       'paste_compound', 'tablespoon', ARRAY['kaju paste'],                              false, true),
('tomato_puree',       'Tomato Puree',       'paste_compound', 'cup',   ARRAY['tamatar puree','crushed tomatoes'],             false, true),

-- ─── CONDIMENTS / SAUCES ───────────────────────────────────────
('soy_sauce',          'Soy Sauce',          'condiment_sauce', 'tablespoon', ARRAY['soya sauce'],                             false, true),
('vinegar',            'Vinegar',            'acid',           'tablespoon', ARRAY['sirka','white vinegar','synthetic vinegar'], false, true),
('tomato_ketchup',     'Tomato Ketchup',     'condiment_sauce', 'tablespoon', ARRAY['ketchup','tomato sauce'],                 false, true),

-- ─── LEAVENING ─────────────────────────────────────────────────
('baking_soda',        'Baking Soda',        'leavening',   'teaspoon', ARRAY['meetha soda','khana soda','sodium bicarbonate'], false, true),
('baking_powder',      'Baking Powder',      'leavening',   'teaspoon', ARRAY[]::text[],                                       false, true),
('yeast',              'Yeast',              'leavening',   'teaspoon', ARRAY['khameer','dry yeast','active dry yeast'],        false, true),

-- ─── OTHER ─────────────────────────────────────────────────────
('water',              'Water',              'other',       'cup',       ARRAY['pani'],                                        true,  true),
('cornflour_slurry',   'Cornflour Slurry',   'other',       'tablespoon', ARRAY[]::text[],                                     false, true)

ON CONFLICT (canonical_id) DO NOTHING;

COMMIT;
