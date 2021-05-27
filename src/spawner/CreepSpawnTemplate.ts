import { IOwnedRoomManager } from "interfaces";
import { build } from "utils/BodyBuilder"

export interface CreepSpawnTemplate {
    getBodyParts(): BodyPartConstant[]
    getMemory(): CreepMemory
}

export class GenericCreepTemplate implements CreepSpawnTemplate {
    constructor(private room: IOwnedRoomManager, private emergency: boolean = false) {}

    getBodyParts(): BodyPartConstant[] {
        if(this.emergency) {
            return [MOVE, MOVE, CARRY, WORK];
        }

        return build([WORK, CARRY, MOVE], this.room.getMaxSpawnPower());
    }

    getMemory(): CreepMemory {
        return {
            room: this.room.name,
            role: "generic",
            remote: false
        };
    }
}

export class MinerCreepTemplate implements CreepSpawnTemplate {
    private maxBudget = 800 // 6 * WORK + 3 * MOVE = 750 energy

    constructor(private room: IOwnedRoomManager, private remote = false) {}

    getBodyParts(): BodyPartConstant[] {
        const budget = Math.min(this.room.getMaxSpawnPower(), this.maxBudget)
        if(this.remote) {
            return build([WORK, WORK, MOVE], budget, [CARRY]);
        }
        return build([WORK, WORK, MOVE], budget);
    }

    getMemory(): CreepMemory {
        return {
            room: this.room.name,
            role: "miner",
            remote: this.remote,
        };
    }
}

export class BuilderCreepTemplate implements CreepSpawnTemplate {
    constructor(private room: IOwnedRoomManager, private remote = false) {}

    getBodyParts(): BodyPartConstant[] {
        return build([WORK, CARRY, MOVE], this.room.getMaxSpawnPower());
    }

    getMemory(): CreepMemory {
        return {
            room: this.room.name,
            role: "builder",
            remote: this.remote
        };
    }
}

export class HaulerCreepTemplate implements CreepSpawnTemplate {
    constructor(private room: IOwnedRoomManager, private remote = false) {}

    getBodyParts(): BodyPartConstant[] {
        if(this.remote) {
            return build([CARRY, MOVE], this.room.getMaxSpawnPower(), [WORK, MOVE]);
        }
        return build([CARRY, MOVE], this.room.getMaxSpawnPower());
    }

    getMemory(): CreepMemory {
        return {
            room: this.room.name,
            role: "hauler",
            remote: this.remote,
        };
    }
}

export class ScoutCreepTemplate implements CreepSpawnTemplate {
    constructor(private roomName: string) {}

    getBodyParts(): BodyPartConstant[] {
        return [MOVE]
    }

    getMemory(): CreepMemory {
        return {
            room: this.roomName,
            role: "scout",
            remote: true
        };
    }
}

export class ReserveCreepTemplate implements CreepSpawnTemplate {
    constructor(private roomName: string) {}

    getBodyParts(): BodyPartConstant[] {
        return [MOVE, MOVE, MOVE, MOVE, CLAIM, CLAIM]
    }

    getMemory(): CreepMemory {
        return {
            room: this.roomName,
            role: "reserve",
            remote: true
        };
    }
}

