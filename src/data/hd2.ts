export type ApiType = "live" | "legend";

export type ValueTypes = [number, number];
export type Values = [number, number];

export interface APIGalacticWarEffect {
  id: number;
  gameplayEffectId32: number;
  effectType: number;
  flags: number;
  nameHash: number;
  descriptionFluffHash: number;
  descriptionGamePlayLongHash: number;
  descriptionGamePlayShortHash: number;
  valueTypes: ValueTypes;
  values: Values;
  [key: string]: unknown;
}

export interface APIStatus {
  storyBeatId32: number;
}

// prettier-ignore
export const def_effect_types: Record<number, string> = {
   1: "war_LibMultiplier",        // applies a liberation multiplier
  20: "game_SEAFSupport",         // mission_support_seaf_squads
  21: "game_ExtractionTime",      // applies change in seconds to extraction time
  23: "game_EagleRearmTime",      // applies change in percentage to Eagle Re-Arm time
  24: "game_VehicleFuel",         // not sure what this does yet, but something about fuel shortage
  25: "game_AmmoStartAmount",     // applies change in starting ammo percent // mission_helldiver_insertion_mags_modified
  29: "game_DiverMeleeDamage",    // mission_helldiver_melee_damage_modified
  32: "game_StratagemPermit",     // gives a free stratagem
  33: "game_DiverRegen",          // mission_helldiver_regeneration_modified
  36: "game_CooldownTime",        // adjusts stratagem cooldown timer (vt[0] == 1? apply to all passing vv[0] bitwise traitmask)
  40: "game_EnemyDivision",       // adds a special enemy to missions
  // 43
  // 44
  45: "unk_AdditionalPayout",     // 45: "ADDITIONAL PAYOUT"
  // 46
  47: "war_ImpenetrableDefense",  // ? "IMPENETRABLE DEFENSE" The defenses of this planet are so strong that no enemy will be able to invade.
  48: "war_CrippledAttackSupply", // ? "CRIPPLED SUPPLY" The ability of this planet to attack is crippled.
  49: "war_AttackIncrease",       // ? "MINOR ATTACK INCREASE" [vt_None, vt_Percent] [0, 10] / "LARGE ATTACK INCREASE" [0, 100] / "ATTACK INCREASE" [0, 20]
  51: "game_HealthStamina",       // changes Health&Stam regen, val1/2 uncertain
  52: "game_NoHealing",           // mission_no_healing
  54: "game_IntelScanners",       // ? "INTEL SCANNERS" The location of Intel is  indicated on the mini-map.
  55: "game_IntelHostility",      // mission_intel_hostility_modified
  56: "game_AmmoPickupAmount",    // changes Ammo&Supply Box pickups, val1 changes magazines, val2 changes rounds
  59: "game_MultiplyPayoutBonus", // mission_payout_bonus_multiplier_added
  60: "game_PayoutStandardized",  // mission_payout_standardized
  61: "game_StimsStartAmount",    // applies change in starting stims amount
  63: "game_StimsPickupAmount",   // changes Health&Supply Box pickups, val1 changes number of stims recovered
  67: "unk_MarketPriceMult",      // "MARKET CRASH" Due to the risk of Famine, the market is concerned and prices have gone up 100%.
  68: "unk_ItemCostByProgress",   // modify_item_cost_by_progression_tag
  69: "game_ReinforceAmount",     // changes the number of starting reinforcements per squad member
  70: "map_PlanetBody",           // replaces the actual planet graphic // Value1: [GalaxyEventType]
  71: "map_PlanetToken",          // gives planet a token + description, sometimes places a pawn // Value1: [RawId32] 
  72: "game_EnemySpawnWeight",    // enemy_spawn_weight // Value1: [RawId] - Value2: Percentage[Spawn_Weight]
  73: "map_PlanetCloud",          // // Value1: percentage of gloom radius, Value2: percentage of intensity
  74: "war_RegenRelativePct",     // // Value1: Modifies the planet's regen by a percentage of its default regen
  75: "game_MissionIdOverride",   // // Value1: RawIdString32 - mission id, Value 2 - boolean
  76: "map_PlanetHide",           // hides planet from the map
  77: "war_RegenOverride",        // overrides a planet's HP regen // Value1: [FixedValue] + or -
  78: "game_GameplayGeneric",     // ??? gameplay_generic
  79: "game_ThrowableStartCount", // mission_helldiver_insertion_throwables_modified
  80: "game_StimsAmountMax",      // Changes maximum stims amount // mission_helldiver_max_stim_count_modified
  81: "game_StratagemDisabled",   // stratagem_disabled
  82: "game_BoosterDisabled",     // booster_disabled
  83: "game_BoosterPermit",       // gives a free booster
  84: "game_HealthAmountMax",     // entity_max_health_modified
  85: "game_WeaponMagCount",      // entity_weapon_magazine_count_modified
  86: "game_WeaponAmmoCount",     // entity_weapon_magazine_ammo_modified
  87: "game_AttackEffect",        // generates a constant attack during ops (eagles/bombardment) // mission_entity_spawned
  88: "war_PauseDefense",         // causes the expiretime to increment by 1 * VALUE with wartime (effective pause)
  89: "war_PreventAttacking",     // prevents attacks originating from this planet // defend_event_source_blocked
  90: "war_MaxPlanetHP",          // takes current HP and adds/subtracts to it relatively
  91: "game_StratGroupCooldown",  // mission_helldiver_stratagem_group_cooldown_modified
  92: "war_Demilitarized",        // prevents attacks against this planet
  93: "game_OperationModToggle",  // game_operation_modifier_toggle
}

// prettier-ignore
export const def_effect_value_types: Record<number, string> = {
   0: "vt_None",
   1: "vt_Count",
   2: "vt_Percent",
   3: "vt_UNK3",
   4: "vt_MixID",
   5: "vt_UNK5",
   6: "vt_DEP_EnemyGroup",      // DEPRECATED, modern enemy group types use resourceHash instead
   7: "vt_DEP_ItemPackage",     // DEPRECATED, only instance uses 3639986401, which is Muscle Enhancement; ET:45
   8: "vt_UNK8",
   9: "vt_UNK9",
  10: "vt_rewardMultiplierId",  // refer to: /api/Mission/RewardEntries
  11: "vt_UNK11",
  12: "vt_itemTag",             // or item group; gets used in /Progression/Items
  13: "vt_hashId",
  14: "vt_planetBodyType",      // BlackHole = 1, UNKNOWN = 2
  15: "vt_unkBoolean",          // might be a boolean flag, only used with game_OperationModToggle so far
  16: "vt_resourceHash",        // murmur2 resource hash
}
