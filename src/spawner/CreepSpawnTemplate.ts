import { RoomManager } from "tasks/RoomManager";
import { build } from "utils/BodyBuilder"

export interface CreepSpawnTemplate {
    getBodyParts(): BodyPartConstant[]
    getMemory(): CreepMemory
}

export class GenericCreepTemplate implements CreepSpawnTemplate {
    constructor(private room: RoomManager) {}

    getBodyParts(): BodyPartConstant[] {
        return [MOVE, MOVE, CARRY, WORK];
    }

    getMemory(): CreepMemory {
        return {
            room: this.room.name,
            role: "generic",
        };
    }
}

export class MinerCreepTemplate implements CreepSpawnTemplate {
    private maxBudget = 800 // 6 * WORK + 3 * MOVE = 750 energy

    constructor(private room: RoomManager) {}

    getBodyParts(): BodyPartConstant[] {
        return build([MOVE, WORK, WORK], Math.min(this.room.getMaxSpawnPower(), this.maxBudget));
    }

    getMemory(): CreepMemory {
        return {
            room: this.room.name,
            role: "miner",
        };
    }
}

export class BuilderCreepTemplate implements CreepSpawnTemplate {
    constructor(private room: RoomManager) {}

    getBodyParts(): BodyPartConstant[] {
        return build([MOVE, CARRY, WORK], this.room.getMaxSpawnPower());
    }

    getMemory(): CreepMemory {
        return {
            room: this.room.name,
            role: "builder",
        };
    }
}

