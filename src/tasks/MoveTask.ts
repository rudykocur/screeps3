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
                visualizePathStyle: {
                    fill: 'yellow'
                }
            });
        }
        else {
            return RunResult.DONE;
        }
    }

    toString() {
        return `[MoveTask actor=${this.actor} target=${this.target}, range=${this.range}]`
    }
}
