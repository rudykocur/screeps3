import { TaskWithActor } from "TaskManager";
import { RunResult, RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";


interface WaitTaskMemory {
    actorId: Id<Creep>
    done: boolean
    ticks: number
}

interface WaitTaskArgs {
    ticks: number
    actor: Creep
}

@PersistentTask.register
export class WaitTask extends PersistentTask<WaitTaskMemory, WaitTaskArgs> implements TaskWithActor {
    private actor?: Creep | null

    initMemory(args: WaitTaskArgs): WaitTaskMemory {
        return {
            actorId: args.actor.id,
            ticks: args.ticks,
            done: false,
        }
    }
    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
    }

    doRun(): RunResultType {
        if(this.memory.done) {
            return RunResult.DONE
        }
        else {
            this.memory.done = true
            this.sleep(this.memory.ticks)
        }
    }

    getActorId() {
        return this.actor?.id
    }

    toString() {
        return `[WaitTask actor=${this.actor}]`
    }
}
