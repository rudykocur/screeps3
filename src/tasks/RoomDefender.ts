import { IEventBus } from "bus/EventBus";
import { ThreatEvents, ThreatEventsChannel, THREAT_EVENTS_BUS_NAME } from "bus/ThreatEvents";
import { IRoomManager, IThreatManager } from "interfaces";
import { Logger } from "Logger";
import { RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { RoomAnalyst } from "./RoomAnalyst";
import { RoomManager } from "./RoomManager";


interface RoomDefenderMemory {
    roomName: string
}

interface RoomDefenderArgs {
    room: RoomManager
}

@PersistentTask.register
export class RoomDefender extends PersistentTask<RoomDefenderMemory, RoomDefenderArgs> {

    private analyst?: RoomAnalyst | null
    private room?: Room | null
    private manager?: IRoomManager | null
    private eventBus?: IEventBus<ThreatEvents>
    private threatManager?: IThreatManager | null

    private logger = new Logger('RoomDefender')

    initMemory(args: RoomDefenderArgs): RoomDefenderMemory {
        return {
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.room = Game.rooms[this.memory.roomName]
        this.manager = Game.manager.getRoomManager(this.memory.roomName)
    }

    doLateInit() {
        const room = Game.manager.getRoomManager(this.memory.roomName)
        this.analyst = room?.getRoomAnalyst()
        this.eventBus = room?.getEventBus().getBus(THREAT_EVENTS_BUS_NAME)
        this.threatManager = room?.getThreatManager()

        this.eventBus?.subscribe(ThreatEventsChannel.THREAT_STARTED, this.handleThreatStarted.bind(this))
        this.eventBus?.subscribe(ThreatEventsChannel.THREAT_ENDED, this.handleThreatEnded.bind(this))
    }

    doRun(): RunResultType {
        if(!this.room || !this.analyst || !this.threatManager) {
            return
        }

        // const enemies = this.room.find(FIND_HOSTILE_CREEPS)
        const status = this.threatManager.getThreatStatus()

        const toHeal = this.room.find(FIND_MY_CREEPS, {
            filter: creep => creep.hits < creep.hitsMax
        })

        if(status.getHostileCreeps().length > 0) {
            this.defendRoom(this.analyst, status.getHostileCreeps())
        }
        else if(toHeal.length > 0) {
            this.healCreeps(this.analyst, toHeal)
        }
        else {
            this.sleep(50)
        }
    }

    private handleThreatStarted() {
        this.logger.warn(this, `Starting threat defence`)
        this.wakeUp()
    }

    private handleThreatEnded() {}

    defendRoom(analyst: RoomAnalyst, enemies: Creep[]) {
        for(const tower of analyst.getTowers()) {
            const enemy = tower.pos.findClosestByRange(enemies)
            if(enemy) {
                tower.attack(enemy)
            }
        }
    }

    healCreeps(analyst: RoomAnalyst, toHeal: Creep[]) {
        for(const tower of analyst.getTowers()) {
            const creep = tower.pos.findClosestByRange(toHeal)
            if(creep) {
                tower.heal(creep)
            }
        }
    }

    toString() {
        return `[RoomDefender ${this.manager?.label || this.memory.roomName}]`
    }
}
