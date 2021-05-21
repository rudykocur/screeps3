import { RoomManager } from "tasks/RoomManager";
import { build } from "utils/BodyBuilder"

export interface CreepSpawnTemplate {
    getBodyParts(): BodyPartConstant[]
    getMemory(): CreepMemory
}

export class GenericCreepTemplate implements CreepSpawnTemplate {
    constructor(private room: RoomManager, private emergency: boolean = false) {}

    getBodyParts(): BodyPartConstant[] {
        if(this.emergency) {
            return [MOVE, MOVE, CARRY, WORK];
        }

        return build([MOVE, CARRY, WORK], this.room.getMaxSpawnPower());
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

export class HaulerCreepTemplate implements CreepSpawnTemplate {
    constructor(private room: RoomManager) {}

    getBodyParts(): BodyPartConstant[] {
        return build([MOVE, CARRY], this.room.getMaxSpawnPower());
    }

    getMemory(): CreepMemory {
        return {
            room: this.room.name,
            role: "hauler",
        };
    }
}

export class ScoutCreepTemplate implements CreepSpawnTemplate {
    constructor(private roomName: string) {}

    getBodyParts(): BodyPartConstant[] {
        return [MOVE]
        // return [MOVE, MOVE, MOVE, MOVE, CLAIM, CLAIM]
    }

    getMemory(): CreepMemory {
        return {
            room: this.roomName,
            role: "scout",
        };
    }
}

