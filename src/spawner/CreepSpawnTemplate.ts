import { IOwnedRoomManager, IRoomManager } from "interfaces";
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

        return build({
            pattern: [WORK, CARRY, MOVE],
            budget: this.room.getMaxSpawnPower()
        });
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
            return build({
                pattern: [WORK, WORK, MOVE],
                budget: budget,
                prefix: [CARRY]
            });
        }
        return build({
            pattern: [WORK, WORK, MOVE],
            budget: budget
        });
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
        return build({
            pattern: [WORK, CARRY, MOVE],
            budget: this.room.getMaxSpawnPower()
        });
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
            return build({
                pattern: [MOVE, CARRY],
                budget: this.room.getMaxSpawnPower(),
                prefix: [WORK, MOVE]
            });
        }
        return build({
            pattern: [MOVE, CARRY],
            budget: this.room.getMaxSpawnPower(),
        });
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

export class DefenderCreepTemplate implements CreepSpawnTemplate {
    constructor(private room: IOwnedRoomManager, private targetRoomName: string) {}

    getBodyParts(): BodyPartConstant[] {
        return build({
            pattern: [TOUGH, ATTACK, MOVE, MOVE],
            budget: this.room.getMaxSpawnPower(),
            prefix: [TOUGH, TOUGH, TOUGH, TOUGH],
            suffix: [RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE]
        });
    }

    getMemory(): CreepMemory {
        return {
            room: this.targetRoomName,
            role: "defender",
            remote: true
        };
    }
}

