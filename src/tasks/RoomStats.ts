import { CreepRole } from "../constants";
import { RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { RoomAnalyst } from "./RoomAnalyst";
import { IOwnedRoomManager, IOwnedRoomStats, IRemoteRoomStats, IRoomManager } from "interfaces";
import { TaskInitArgs, TaskMemory, Type } from "types";
import { StatProvider } from "stats/interfaces";
import { EnergyInStorageMemory, EnergyInStorageStatProvider } from "stats/providers/EnergyInStorageStatProvider";
import { EnergyToPickupMemory, EnergyToPickupStatProvider } from "stats/providers/EnergyToPickupStatProvider";
import { LastSpawnTimeMemory, LastSpawnTimeStatProvider } from "stats/providers/LastSpawnTimeStatProvider";
import { EnergyHarvestedMemory, EnergyHarvestedStatProvider } from "stats/providers/EnergyHarvestedStatProvider";
import { SpawnerUsageMemory, SpawnerUsageStatProvider } from "stats/providers/SpawnerUsageStatProvider";

interface RoomStatsMemory extends EnergyToPickupMemory, EnergyInStorageMemory, LastSpawnTimeMemory, EnergyHarvestedMemory, SpawnerUsageMemory {
    roomName: string
}

interface RoomStatsArgs {
    room: IOwnedRoomManager
}

export abstract class RoomStatsBase<M extends TaskMemory, IA extends TaskInitArgs> extends PersistentTask<M, IA> {
    protected providers: StatProvider[] = []

    getProvider<T extends StatProvider>(clazz: Type<T>): T {
        return this.providers.find(provider => provider.constructor.name === clazz.name) as T
    }
}

@PersistentTask.register
export class RoomStats extends RoomStatsBase<RoomStatsMemory, RoomStatsArgs> implements IOwnedRoomStats {
    private analyst?: RoomAnalyst | null
    private room?: IOwnedRoomManager | null

    initMemory(args: RoomStatsArgs): RoomStatsMemory {
        return {
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.room = Game.manager.getOwnedRoomManager(this.memory.roomName)

        if(this.room) {
            this.providers = [
                new EnergyToPickupStatProvider(this.memory),
                new EnergyInStorageStatProvider(this.memory),
                new SpawnerUsageStatProvider(this.memory, this.room),
                new LastSpawnTimeStatProvider(this.memory, this.room),
                new EnergyHarvestedStatProvider(this.memory, this.room),
            ]
        }
    }

    doLateInit() {
        this.analyst = this.room?.getRoomAnalyst()
    }

    doRun(): RunResultType {
        if(!this.analyst) {
            return
        }

        for(const provider of this.providers) {
            provider.run(this.analyst)
        }

        this.sleep(20)
    }

    getAverageEnergyToPickup() {
        return this.getProvider(EnergyToPickupStatProvider).getAverage()
    }

    getAverageEnergyInStorage() {
        return this.getProvider(EnergyInStorageStatProvider).getAverage()
    }

    getTicksSinceLastSpawn(role: CreepRole) {
        return this.getProvider(LastSpawnTimeStatProvider).getTicksSinceLastSpawn(role)
    }

    getHarvestedEnergy() {
        return this.getProvider(EnergyHarvestedStatProvider).getHarvestedAmount()
    }

    getAverageSpawnUsage() {
        return this.getProvider(SpawnerUsageStatProvider).getAverageUsage()
    }

    toString() {
        return `[RoomStats ${this.room?.label || this.memory.roomName}]`
    }
}

interface RemoteRoomStatsMemory extends EnergyToPickupMemory, EnergyHarvestedMemory {
    roomName: string
}

interface RemoteRoomStatsArgs {
    room: IRoomManager
}

@PersistentTask.register
export class RemoteRoomStats extends RoomStatsBase<RemoteRoomStatsMemory, RemoteRoomStatsArgs> implements IRemoteRoomStats {
    private analyst?: RoomAnalyst
    private room?: IRoomManager | null

    initMemory(args: RemoteRoomStatsArgs): RemoteRoomStatsMemory {
        return {
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.room = Game.manager.getRoomManager(this.memory.roomName)

        if(this.room) {
            this.providers = [
                new EnergyToPickupStatProvider(this.memory),
                new EnergyHarvestedStatProvider(this.memory, this.room),
            ]
        }
    }

    doRun(): RunResultType {
        if(!this.analyst) {
            return
        }

        for(const provider of this.providers) {
            provider.run(this.analyst)
        }

        this.sleep(20)
    }

    getAverageEnergyToPickup() {
        return this.getProvider(EnergyToPickupStatProvider).getAverage()
    }

    getHarvestedEnergy() {
        return this.getProvider(EnergyHarvestedStatProvider).getHarvestedAmount()
    }

    setAnalyst(anaylst: RoomAnalyst) {
        this.analyst = anaylst
    }

    toString() {
        return `[RmoteRoomStats ${this.room?.label || this.memory.roomName}]`
    }
}
