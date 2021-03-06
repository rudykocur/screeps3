
// export type CREEP_ROLE_GENERIC = "generic"
// export type CREEP_ROLE_MINER = "miner"

type CREEP_ROLE_GENERIC = "generic"
type CREEP_ROLE_MINER = "miner"
type CREEP_ROLE_BUILDER = "builder"
type CREEP_ROLE_HAULER = "hauler"
type CREEP_ROLE_SCOUT = "scout"
type CREEP_ROLE_RESERVE = "reserve"
type CREEP_ROLE_DEFENDER = "defender"

export const CREEP_ROLE_GENERIC: CREEP_ROLE_GENERIC = "generic"
export const CREEP_ROLE_MINER: CREEP_ROLE_MINER = "miner"
export const CREEP_ROLE_BUILDER: CREEP_ROLE_BUILDER = "builder"
export const CREEP_ROLE_HAULER: CREEP_ROLE_HAULER = "hauler"
export const CREEP_ROLE_SCOUT: CREEP_ROLE_SCOUT = "scout"
export const CREEP_ROLE_RESERVE: CREEP_ROLE_RESERVE = "reserve"
export const CREEP_ROLE_DEFENDER: CREEP_ROLE_DEFENDER = "defender"

export type CreepRole =
    | CREEP_ROLE_GENERIC
    | CREEP_ROLE_MINER
    | CREEP_ROLE_BUILDER
    | CREEP_ROLE_HAULER
    | CREEP_ROLE_SCOUT
    | CREEP_ROLE_RESERVE
    | CREEP_ROLE_DEFENDER
