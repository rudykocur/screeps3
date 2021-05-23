import { Logger } from "Logger";
import { packPos, unpackPos } from "utils/packrat";
import { RunResult, RunResultType } from "../AbstractTask";
import { MoveTask } from "../MoveTask";
import { PersistentTask } from "../PersistentTask";

interface MinerCreepMemory {
    actorId: Id<Creep>
    sourceId: Id<Source>,
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

    private logger = new Logger('MinerCreep')

    initMemory(args: MinerCreepArgs): MinerCreepMemory {
        return {
            actorId: args.actor.id,
            sourceId: args.source.id,
            containerPos: args.container ? packPos(args.container.pos) : undefined,
            mining: false,
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        this.containerPos = this.memory.containerPos ? unpackPos(this.memory.containerPos) : null

        const source = Game.getObjectById(this.memory.sourceId)
        if(source) {
            this.source = source
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
            this.actor.harvest(this.source)
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
