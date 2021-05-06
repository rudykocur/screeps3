import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";

interface BuildTaskMemory {
    actorId: Id<Creep>
    siteId: Id<ConstructionSite>
}

interface BuildTaskArgs {
    actor: Creep
    site: ConstructionSite
}

@PersistentTask.register
export class BuildTask extends PersistentTask<BuildTaskMemory, BuildTaskArgs> {

    private actor?: Creep | null
    private site?: ConstructionSite | null

    private buildRange: number = 3

    initMemory(args: BuildTaskArgs): BuildTaskMemory {
        return {
            actorId: args.actor.id,
            siteId: args.site.id
        }
    }
    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        this.site = Game.getObjectById(this.memory.siteId)
    }

    doRun(): RunResultType {
        if(!this.actor || !this.site) {
            return RunResult.DONE
        }

        if(this.actor.store.getUsedCapacity() === 0) {
            return RunResult.DONE
        }

        if(!this.actor.pos.inRangeTo(this.site, this.buildRange)) {
            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: this.site.pos,
                range: this.buildRange
            })
        }
        else {
            this.actor.build(this.site)
        }
    }

}
