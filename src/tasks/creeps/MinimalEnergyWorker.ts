import { TaskInitArgs, TaskMemory } from "types";
import { RunResult, RunResultType } from "../AbstractTask";
import { DepositEnergy } from "../DepositEnergy";
import { HarvestAndLoadTask } from "../HarvestAndLoadTask";
import { RoomManager } from "../RoomManager";
import { PersistentTask } from "../PersistentTask";
import { PickupResourceTask } from "../PickupResource";

interface MinimalEnergyWorkerMemory extends TaskMemory {
    actorId: Id<Creep>;
    sourceId: Id<Source>;
    roomName: string;
}

interface MinimalEnergyWorkerArgs extends TaskInitArgs {
    actor: Creep;
    source: Source;
    room: RoomManager;
}

@PersistentTask.register
export class MinimalEnergyWorker extends PersistentTask<MinimalEnergyWorkerMemory, MinimalEnergyWorkerArgs> {

    private actor?: Creep;
    private source: Source;
    private room: RoomManager;

    initMemory(args: MinimalEnergyWorkerArgs): MinimalEnergyWorkerMemory {
        return {
            actorId: args.actor.id,
            sourceId: args.source.id,
            roomName: args.room.name,
        }
    }

    doInit(): void {
        const actor = Game.getObjectById<Creep>(this.memory.actorId);
        const source = Game.getObjectById<Source>(this.memory.sourceId);
        const room = Game.manager.getRoomManager(this.memory.roomName);

        if(actor) {
            this.actor = actor;
        }
        if(source) {
            this.source = source;
        }
        if(room) {
            this.room = room;
        }
    }

    doRun(): RunResultType {
        if(!this.actor) {
            return RunResult.DONE
        }

        if(this.actor.store.getFreeCapacity() > 0) {
            const resources = this.room.getDroppedResources();

            if(resources.length > 0) {
                const nearest = this.actor.pos.findClosestByRange(resources);
                this.scheduleBlockingTask(PickupResourceTask, {
                    actor: this.actor,
                    resource: nearest
                })
            }
            else {
                this.scheduleBlockingTask(HarvestAndLoadTask, {
                    actor: this.actor,
                    source: this.source,
                })
            }
        }
        else {
            this.scheduleBlockingTask(DepositEnergy, {
                actor: this.actor,
                room: this.room,
            })
        }
    }

    get roomName() {
        return this.room.name
    }

    toString() {
        return `[MinimalEnergyWorker <${this.taskId}>]`
    }
}

export default MinimalEnergyWorker;
