import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";

interface HarvestAndLoadMemory {
    actorId: Id<Creep>
    sourceId: Id<Source>
}

interface HarvestAndLoadArgs {
    actor: Creep;
    source: Source;
}

@PersistentTask.register
export class HarvestAndLoadTask extends PersistentTask<HarvestAndLoadMemory, HarvestAndLoadArgs> {
    private actor?: Creep | null;
    private source: Source;

    initMemory(args: HarvestAndLoadArgs): HarvestAndLoadMemory {
        return {
            actorId: args.actor.id,
            sourceId: args.source.id,
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        const source = Game.getObjectById(this.memory.sourceId)

        if(source) {
            this.source = source
        }
    }

    doRun(): RunResultType {
        if(!this.actor) {
            return RunResult.DONE
        }

        if(this.actor.store.getFreeCapacity() === 0) {
            return RunResult.DONE
        }

        if(this.actor.pos.isNearTo(this.source.pos)) {
            this.actor.harvest(this.source);
        }
        else {
            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: this.source.pos,
            })
        }
    }


    toString() {
        return `[HarvestAndLoadTasks actor=${this.actor} source=${this.source}]`
    }
}
