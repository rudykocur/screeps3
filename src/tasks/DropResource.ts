import { RoomPositionJson } from "types";
import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";


interface DropResourceMemory {
    actorId: Id<Creep>;
    target: RoomPositionJson;
}

interface DropResourceArgs {
    actor: Creep;
    target: RoomPosition;
}

@PersistentTask.register
export class DropResourceTask extends PersistentTask<DropResourceMemory, DropResourceArgs> {
    private actor?: Creep | null
    private target: RoomPosition

    initMemory(args: DropResourceArgs): DropResourceMemory {
        return {
            actorId: args.actor.id,
            target: {
                x: args.target.x,
                y: args.target.y,
                roomName: args.target.roomName,
            },
        }
    }
    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId);
        this.target = new RoomPosition(this.memory.target.x, this.memory.target.y, this.memory.target.roomName);
    }
    doRun(): RunResultType {
        if(!this.actor) {
            return RunResult.DONE
        }

        if(this.actor.store.getUsedCapacity() === 0) {
            return RunResult.DONE
        }

        if(this.actor.pos.isEqualTo(this.target)) {
            this.actor.drop(RESOURCE_ENERGY);
        }
        else {
            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: this.target,
                range: 0,
            })
        }
    }

    toString() {
        return `[DropResourceTask actor=${this.actor} target=${this.target}]`
    }
}
