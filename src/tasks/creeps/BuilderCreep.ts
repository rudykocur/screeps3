import { RunResult, RunResultType } from "tasks/AbstractTask";
import { BuildTask } from "tasks/BuildTask";
import { PersistentTask } from "tasks/PersistentTask";
import { RoomManager } from "tasks/RoomManager";
import { WithdrawEnergy } from "tasks/WithdrawEnergy";

interface BuilderCreepMemory {
    actorId: Id<Creep>
    roomName: string
}

interface BuilderCreepArgs {
    actor: Creep
    room: RoomManager
}

@PersistentTask.register
export class BuilderCreep extends PersistentTask<BuilderCreepMemory, BuilderCreepArgs> {

    private actor?: Creep | null
    private room?: RoomManager | null

    initMemory(args: BuilderCreepArgs): BuilderCreepMemory {
        return {
            actorId: args.actor.id,
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        this.room = Game.manager.getRoomManager(this.memory.roomName)
    }

    doRun(): RunResultType {
        if(!this.actor || !this.room) {
            return RunResult.DONE
        }

        if(this.actor.store.getUsedCapacity() === 0) {
            this.scheduleBlockingTask(WithdrawEnergy, {
                actor: this.actor,
                room: this.room
            })
        }
        else {
            const analyst = this.room.getRoomAnalyst()
            if(analyst) {
                const sites = analyst.getConstructionSites()

                const site = this.actor.pos.findClosestByPath(sites)

                if(site) {
                    this.scheduleBlockingTask(BuildTask, {
                        actor: this.actor,
                        site: site
                    })
                }
                else {
                    this.sleep(40)
                }
            }
        }
    }

    getActorId() {
        return this.memory.actorId
    }

    toString() {
        return `[BuilderCreep actor=${this.actor}]`
    }

}
