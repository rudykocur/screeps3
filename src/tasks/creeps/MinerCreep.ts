import { IEventBus } from "bus/EventBus";
import { RoomEvents, RoomEventsChannel, ROOM_EVENTS_BUS_NAME } from "bus/RoomActionsEvents";
import { Logger } from "Logger";
import { packPos, unpackPos } from "utils/packrat";
import { RunResult, RunResultType } from "../AbstractTask";
import { MoveTask } from "../MoveTask";
import { PersistentTask } from "../PersistentTask";

interface MinerCreepMemory {
    actorId: Id<Creep>
    sourceId: Id<Source>,
    containerId?: Id<StructureContainer> | null
    containerPos?: string,
    mining?: boolean
}

interface MinerCreepArgs {
    actor: Creep;
    source: Source;
    container?: StructureContainer | null
}

@PersistentTask.register
export class MinerCreep extends PersistentTask<MinerCreepMemory, MinerCreepArgs> {
    private actor?: Creep | null
    private source?: Source | null
    private containerPos?: RoomPosition | null
    private container?: StructureContainer | null
    private bus?: IEventBus<RoomEvents>

    private logger = new Logger('MinerCreep')

    initMemory(args: MinerCreepArgs): MinerCreepMemory {
        return {
            actorId: args.actor.id,
            sourceId: args.source.id,
            containerPos: args.container ? packPos(args.container.pos) : undefined,
            containerId: args.container?.id,
            mining: false,
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        this.containerPos = this.memory.containerPos ? unpackPos(this.memory.containerPos) : null
        this.container = this.memory.containerId ? Game.getObjectById(this.memory.containerId) : null

        const source = Game.getObjectById(this.memory.sourceId)
        if(source) {
            this.source = source

            this.bus = Game.manager.getRoomManager(this.source.pos.roomName)?.getEventBus().getBus(ROOM_EVENTS_BUS_NAME)
        }
    }

    doRun(): RunResultType {
        if(!this.actor || !this.source) {
            return RunResult.DONE
        }

        if(!this.memory.mining) {
            if(this.containerPos && this.actor.pos.isEqualTo(this.containerPos)) {
                this.logger.info(this, 'Reached mining container!')
                this.memory.mining = true
            }
            else if(this.actor.pos.isNearTo(this.source)) {
                this.logger.info(this, 'Reached source!')
                this.memory.mining = true
            }
        }

        if(this.memory.mining) {
            if(this.container && this.actor.getActiveBodyparts(CARRY) > 0 && this.actor.store.getUsedCapacity(RESOURCE_ENERGY) && this.container.hits < this.container.hitsMax) {
                this.actor.repair(this.container)
            }
            else {
                const result = this.actor.harvest(this.source)

                if(result === OK && this.bus) {
                    const workParts = this.actor.getActiveBodyparts(WORK)

                    this.bus.dispatch(RoomEventsChannel.SOURCE_HARVESTED, {
                        actor: this.actor,
                        roomName: this.actor.pos.roomName,
                        amount: workParts * HARVEST_POWER
                    })
                }
            }
        }
        else {
            if(this.containerPos) {
                this.scheduleBlockingTask(MoveTask, {
                    actor: this.actor,
                    target: this.containerPos,
                    range: 0
                })
            }
            else {
                this.scheduleBlockingTask(MoveTask, {
                    actor: this.actor,
                    target: this.source.pos,
                    range: 1
                })
            }
        }
    }

    getActorId() {
        return this.actor?.id
    }

    getSourceId() {
        return this.source?.id
    }

    toString() {
        return `[MinerCreep actor=${this.actor} souce=${this.source} container=${this.containerPos?'yes':'no'}]`
    }
}
