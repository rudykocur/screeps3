import { RoomPositionJson } from "types";
import { packPos, unpackPos } from "utils/packrat";
import { RunResult, RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";

interface MoveTaskMemory {
    actorId: Id<Creep>
    target: string
    range: number
}

interface MoveTaskArgs {
    actor: Creep
    target: RoomPosition
    range?: number
}

@PersistentTask.register
export class MoveTask extends PersistentTask<MoveTaskMemory, MoveTaskArgs> {
    private actor?: Creep | null
    private target: RoomPosition
    private range: number

    initMemory(args: MoveTaskArgs): MoveTaskMemory {
        return {
            actorId: args.actor.id,
            target: packPos(args.target),
            range: args.range ?? 1
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId);

        this.range = this.memory.range;

        this.target = unpackPos(this.memory.target)
    }

    doRun(): RunResultType {
        if(!this.actor || !this.target) {
            return RunResult.DONE
        }

        if(!this.target.inRangeTo(this.actor.pos, this.range)) {
            this.actor.moveTo(this.target, {
                maxOps: 3000,
                visualizePathStyle: {
                    fill: 'yellow'
                }
            });

            if(this.actor.getActiveBodyparts(WORK) > 0 && this.actor.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                const repairable = this.actor.pos.findInRange(FIND_STRUCTURES, 3, {
                    filter: obj => obj.hits < obj.hitsMax
                })
                if(repairable.length > 0) {
                    this.actor.repair(repairable[0])
                }
            }
        }
        else {
            return RunResult.DONE;
        }
    }

    toString() {
        return `[MoveTask actor=${this.actor} target=${this.target}, range=${this.range}]`
    }
}
