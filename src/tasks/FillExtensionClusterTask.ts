import { TaskWithActor } from "TaskManager";
import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";
import { ExtensionCluster } from "./RoomAnalyst";


interface FillExtensionClusterMemory {
    actorId: Id<Creep>
    clusterId: string
    roomName: string
}

interface FillExtensionClusterArgs {
    actor: Creep
    cluster: ExtensionCluster
}

@PersistentTask.register
export class FillExtensionClusterTask extends PersistentTask<FillExtensionClusterMemory, FillExtensionClusterArgs> implements TaskWithActor {
    private actor?: Creep | null
    private cluster?: ExtensionCluster | null

    initMemory(args: FillExtensionClusterArgs): FillExtensionClusterMemory {
        return {
            actorId: args.actor.id,
            clusterId: args.cluster.id,
            roomName: args.cluster.center.roomName
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId);
        const analyst = Game.manager.getRoomManager(this.memory.roomName)?.getRoomAnalyst()
        this.cluster = analyst?.getExtensionClusters().find(cluster => cluster.id === this.memory.clusterId)
    }

    doRun(): RunResultType {

        if(!this.actor || !this.cluster) {
            return RunResult.DONE
        }

        if(this.actor.store.getUsedCapacity() === 0) {
            return RunResult.DONE
        }

        if(this.cluster.getMissingEnergyAmount() <= 0) {
            return RunResult.DONE
        }

        if(this.actor.pos.isEqualTo(this.cluster.center)) {
            const extensions = this.cluster.getExtensionsMissingEnergy()
            if(extensions.length === 0) {
                return RunResult.DONE
            }

            this.actor.transfer(extensions[0], RESOURCE_ENERGY)
        }
        else {
            const carry = this.actor.store.getCapacity()
                Game.reservationManager.getHandler(this.cluster)?.reserve(this, carry)

            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: this.cluster.center,
                range: 0,
            })
        }
    }

    getActorId() {
        return this.actor?.id
    }

    toString() {
        return `[FillExtensionClusterTask actor=${this.actor} target=${this.cluster?.id}]`
    }
}
