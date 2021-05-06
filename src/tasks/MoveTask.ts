import { RoomPositionJson } from "types";
import { RunResult, RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";

interface MoveTaskMemory {
    actorId: Id<Creep>;
    target: RoomPositionJson;
    range: number;
}

interface MoveTaskArgs {
    actor: Creep;
    target: RoomPosition;
    range?: number;
}

@PersistentTask.register
export class MoveTask extends PersistentTask<MoveTaskMemory, MoveTaskArgs> {
    private actor?: Creep;
    private target: RoomPosition;
    private range: number;

    initMemory(args: MoveTaskArgs): MoveTaskMemory {
        return {
            actorId: args.actor.id,
            target: {
                x: args.target.x,
                y: args.target.y,
                roomName: args.target.roomName,
            },
            range: args.range ?? 1
        }
    }

    doInit(): void {
        const actor = Game.getObjectById<Creep>(this.memory.actorId);

        this.target = new RoomPosition(this.memory.target.x, this.memory.target.y, this.memory.target.roomName);
        this.range = this.memory.range;

        if(actor) {
            this.actor = actor;
        }
    }

    doRun(): RunResultType {
        if(!this.actor) {
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
        return `[MoveTask ${this.taskId} actor=${this.actor} target=${this.target}]`
    }
}
