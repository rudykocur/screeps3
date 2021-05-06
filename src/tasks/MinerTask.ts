import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";

interface MinerTaskMemory {
    actorId: Id<Creep>
    sourceId: Id<Source>,
    mining?: boolean
}

interface MinerTaskArgs {
    actor: Creep;
    source: Source;
}

@PersistentTask.register
export class MinerTask extends PersistentTask<MinerTaskMemory, MinerTaskArgs> {
    private actor?: Creep | null;
    private source: Source;

    initMemory(args: MinerTaskArgs): MinerTaskMemory {
        return {
            actorId: args.actor.id,
            sourceId: args.source.id,
            mining: false,
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

        if(!this.memory.mining && this.actor.pos.isNearTo(this.source)) {
            console.log(this, 'Reached source!')
            this.memory.mining = true
        }

        if(this.memory.mining) {
            this.actor.harvest(this.source)
        }
        else {
            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: this.source.pos,
                range: 1
            })
        }
    }

    getActorId() {
        return this.actor?.id
    }

    getSourceId() {
        return this.source.id
    }

    toString() {
        return `[MinerTask actor=${this.actor} souce=${this.source}]`
    }
}
