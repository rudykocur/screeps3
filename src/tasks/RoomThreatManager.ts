import { IEventBus } from "bus/EventBus";
import { ThreatEvents, ThreatEventsChannel, THREAT_EVENTS_BUS_NAME } from "bus/ThreatEvents";
import { IRoomManager, IThreatManager } from "interfaces";
import { Logger } from "Logger";
import { notEmpty } from "utils/common";
import { RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";


interface RoomThreatManagerMemory {
    roomName: string,
    knownCreeps?: Id<Creep>[]
}

interface RoomThreatManagerArgs {
    room: IRoomManager
}

const INVADER_USER_NAME = "Invader"

export class ThreatStatus {
    constructor(
        private hostile: Creep[],
        private neutral: Creep[],
    ) {}

    getHostileCreeps() {
        return this.hostile
    }

    getNeutralCreeps() {
        return this.neutral
    }

    isInvaderAttack() {
        return this.hostile.find(creep => creep.owner.username === INVADER_USER_NAME)
    }

    isActive() {
        return this.hostile.length > 0 || this.neutral.length > 0
    }
}

@PersistentTask.register
export class RoomThreatManager extends PersistentTask<RoomThreatManagerMemory, RoomThreatManagerArgs> implements IThreatManager {

    private room?: Room | null
    private knowEnemies: Creep[]
    private eventBus?: IEventBus<ThreatEvents>
    private threatStatus: ThreatStatus

    private logger = new Logger('RoomThreatManager')

    initMemory(args: RoomThreatManagerArgs): RoomThreatManagerMemory {
        return {
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.room = Game.rooms[this.memory.roomName]

        const manager = Game.manager.getRoomManager(this.memory.roomName)

        this.eventBus = manager?.getEventBus().getBus(THREAT_EVENTS_BUS_NAME)

        this.knowEnemies = this.memory.knownCreeps
            ?.map(id => Game.getObjectById(id))
            .filter(notEmpty) || []

        const [hostile, neutral] = this.divideCreeps(this.knowEnemies)
        this.threatStatus = new ThreatStatus(hostile, neutral)
    }

    doRun(): RunResultType {
        if(!this.room) {
            return
        }

        this.analyzeHostileCreeps(this.room)

        if(this.knowEnemies.length === 0) {
            this.sleep(10)
            return
        }
    }

    private analyzeHostileCreeps(room: Room) {
        const creeps = room.find(FIND_HOSTILE_CREEPS)

        if(this.knowEnemies.length === 0 && creeps.length > 0) {
            Game.notify(`[${Game.time}] New threat in room ${room}`, 5)
            this.logger.warn(this, `Threat started!`)
            this.eventBus?.dispatch(ThreatEventsChannel.THREAT_STARTED, {})
        }
        if((this.memory.knownCreeps?.length || 0) > 0 && creeps.length === 0) {
            Game.notify(`[${Game.time}] Threat in room ${room} eliminated!`, 5)
            this.logger.warn(this, `Threat ended!`)
            this.eventBus?.dispatch(ThreatEventsChannel.THREAT_ENDED, {})
        }

        if(this.memory.knownCreeps) {
            for(const creep of creeps) {
                if(this.memory.knownCreeps.indexOf(creep.id) < 0) {
                    Game.notify(`[${Game.time}] New enemy creep [${creep.name}] from [${creep.owner.username}] with body ${this.creepBodyToString(creep)}`, 5)
                    this.logger.info(this, `Spotted new enemy creep ${creep} at ${creep.pos}`)
                    this.eventBus?.dispatch(ThreatEventsChannel.NEW_THREAT, {
                        creep: creep,
                        isHostile: this.isHostile(creep)
                    })
                }
            }
        }

        this.knowEnemies = creeps
        this.memory.knownCreeps = this.knowEnemies.map(creep => creep.id)
    }

    private divideCreeps(creeps: Creep[]) {
        const hostile = []
        const neutral = []

        for(const creep of creeps) {
            if(this.isHostile(creep)) {
                hostile.push(creep)
            }
            else {
                neutral.push(creep)
            }
        }

        return [hostile, neutral]
    }

    private isHostile(creep: Creep) {
        return !!creep.body.find(part => part.type === ATTACK || part.type === RANGED_ATTACK || part.type === HEAL)
    }

    private creepBodyToString(creep: Creep) {
        return creep.body.map(part => part.type + part.boost ? `[${part.boost}]` : "").join(', ')
    }

    getThreatStatus() {
        return this.threatStatus
    }

    toString() {
        return `[RoomThreatManager ${this.memory.roomName}]`
    }
}
