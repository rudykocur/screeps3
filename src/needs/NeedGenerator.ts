import { RunResult, RunResultType } from "tasks/AbstractTask";
import { PersistentTask } from "tasks/PersistentTask";
import { RoomAnalyst } from "tasks/RoomAnalyst";
import { BuildNeedProvider, RemoteBuildNeedProvider, RepairNeedsProvider } from "./BuilderNeeds";
import { ResourcePickupAtCriticalProvider, ResourcePickupProvider } from "./ResourceNeeds";
import { EmptyContainerAtCriticalNeedProvider, EmptyContainerNeedProvider, EmptyRuinNeedProvider, EmptyTombstoneNeedProvider } from "./EmptyContainersNeeds";
import { MineNeedsProvider } from "./MineNeeds";
import { GenericNeedsProvider, HarvestEnergyAtCriticalNeedsProvider, RestAtSafeZoneNeed, RestAtSafeZoneNeedGenerator } from "./GenericNeeds";
import { EnergyRefillAtCriticalNeedProvider, EnergyRefillNeedsProvider, ExtensionClusterNeedsProvider, SpawnRefillAtCriticalNeedProvider, SpawnRefillNeedsProvider, TowerRefillNeedsProvider } from "./EnergyRefillNeeds";
import { IOwnedRoomManager, IRemoteRoom, IRoomManager, IScheduler } from "interfaces";
import { INeedGenerator, Need, NeedPriority, NeedsProvider } from "./interfaces";
import { Logger } from "Logger";
import _ from "lodash"
import { CreepRole } from "../constants";
import { TaskInitArgs, TaskMemory } from "types";
import { ReserveNeedProvider } from "./RemoteRoomNeeds";

interface NeedGeneratorMemory {
    roomName: string
}

interface NeedGeneratorArgs {
    room: IRoomManager
}

interface RemoteNeedGeneratorMemory {
    roomName: string
    parentRoomName: string
}

interface RemoteNeedGeneratorArgs {
    room: IRoomManager
    parentRoom: IOwnedRoomManager
}

export abstract class NeedGeneratorBase<M extends TaskMemory, IA extends TaskInitArgs> extends PersistentTask<M, IA> implements INeedGenerator {

    protected room?: IRoomManager | null
    protected analyst?: RoomAnalyst | null
    private _needs?: Need[]
    protected providers: NeedsProvider[] = []

    protected additionalGenerators: INeedGenerator[] = []

    protected logger = new Logger('NeedGenerator')

    protected priorityOrder = [NeedPriority.CRITICAL, NeedPriority.HIGH, NeedPriority.NORMAL, NeedPriority.LOW, NeedPriority.LAST]

    abstract initProviders(): void

    doRun(): RunResultType {
        if(!this.room || !this.analyst) {
            return RunResult.DONE
        }
    }

    registerGenerator(generator: INeedGenerator) {
        this.additionalGenerators.push(generator)
    }

    assignTasks(actors: Creep[], remote = false) {
        if(actors.length === 0) {
            return
        }

        const role = actors[0].memory.role

        const tasks = this.getChildTasks()

        const jobless = actors.filter(creep => {
            if(creep.spawning) {
                return false
            }

            return tasks.find(job => {
                if(!('getActorId' in job)) {
                    this.logger.error(`Task ${job} does not have actorId!!!`)
                }
                return 'getActorId' in job && job.getActorId() === creep.id
            }) === undefined
        })

        if(jobless.length === 0) {
            this.logger.debug(this, `All actors busy: role=${role} remote=${remote} actors=${actors}`)
            return
        }

        const needs = this.generateNeeds()

        this.logger.debug(this, `assigning tasks actors=${jobless.length} role=${role} needs=${needs.length} remote=${remote}`)

        for(const actor of jobless) {

            this.logger.debug(this, `Looking task for role=${role} actor=${actor}`)

            let selectedNeed: Need | undefined

            const grouped = _.groupBy(needs, need => need.priority)
            for(const priority of this.priorityOrder) {
                const needsAtLevel = grouped[priority]

                if(!needsAtLevel) {
                    continue
                }

                this.logger.debug(this, `Looking for needs with priority ${priority} (${needsAtLevel.length}): `, needsAtLevel)

                selectedNeed = this.findNeed(needsAtLevel, actor, role, remote)

                if(selectedNeed) {
                    break
                }
            }

            this.logger.debug(this, `Found need priority=${selectedNeed?.priority} need=${selectedNeed}`)

            if(!selectedNeed) {
                continue
            }

            const needIndex = needs.findIndex(need => need === selectedNeed)
            if(needIndex < 0) {
                continue
            }

            selectedNeed.generate(actor)

            if(!selectedNeed.infinite) {
                needs.splice(needIndex, 1)
            }
        }
    }

    findNeed(needs: Need[], actor: Creep, role: CreepRole, remote: boolean) {
        const applicableNeeds = needs.filter(need => {
            if(need.remote && !remote) {
                return false
            }
            if(!need.remote && remote) {
                return false
            }
            return need.roles.indexOf(role) >= 0
        })
        const sortedNeeds = applicableNeeds
            .map(need => {return {need, cost: need.calculateCost(actor)}})
            .sort((a, b) => a.cost - b.cost)
            .map(item => item.need)

        return sortedNeeds[0]
    }

    generateNeeds(): Need[] {
        if(!this.room || !this.analyst) {
            return []
        }

        if(!this._needs) {

            const needs = this.providers
                .filter(provider => provider.isActive())
                .map(provider => provider.generate())
                .reduce((a, b) => a.concat(b), []);

            const additionalNeeds = this.additionalGenerators
                .map(generator => generator.generateNeeds())
                .reduce((a, b) => a.concat(b), [])

            this._needs = needs.concat(additionalNeeds)

            this.logger.debug(this, `Generating needs: local=${needs.length}, remote=${additionalNeeds.length}, additionalGenerators=${this.additionalGenerators.length}`)
        }

        return this._needs
    }

    toString() {
        return `[NeedGenerator ${this.room}]`
    }
}

@PersistentTask.register
export class NeedGenerator extends NeedGeneratorBase<NeedGeneratorMemory, NeedGeneratorArgs> {

    initMemory(args: NeedGeneratorArgs): NeedGeneratorMemory {
        return {
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.room = Game.manager.getOwnedRoomManager(this.memory.roomName)
        this.analyst = this.room?.getRoomAnalyst()

        this.initProviders()
    }

    initProviders(): void {
        if(this.room && this.analyst) {
            this.providers.push(
                new ResourcePickupProvider(this, this.room, this.room, this.analyst, false),
                new EmptyContainerNeedProvider(this, this.room, this.room, this.analyst, this.analyst, false),
                new SpawnRefillNeedsProvider(this, this.room, this.analyst),
                new SpawnRefillAtCriticalNeedProvider(this, this.room, this.analyst),
                new EnergyRefillNeedsProvider(this, this.room, this.analyst),
                new TowerRefillNeedsProvider(this, this.room, this.analyst),
                new ExtensionClusterNeedsProvider(this, this.room, this.analyst),
                new MineNeedsProvider(this, this.analyst, false),
                new BuildNeedProvider(this, this.room, this.analyst, false),
                new RepairNeedsProvider(this, this.room, this.analyst),
                new GenericNeedsProvider(this, this.room, this.analyst),
                new EmptyTombstoneNeedProvider(this, this.room, this.analyst),
                new EmptyRuinNeedProvider(this, this.room, this.analyst),
                new EmptyContainerAtCriticalNeedProvider(this, this.room, this.room, this.analyst, this.analyst, false),
                new EnergyRefillAtCriticalNeedProvider(this, this.room, this.analyst),
                new ResourcePickupAtCriticalProvider(this, this.room, this.room, this.analyst, false),
                new HarvestEnergyAtCriticalNeedsProvider(this, this.room, this.analyst),
                new RestAtSafeZoneNeedGenerator(this, this.analyst, false)
            )
        }
    }
}

@PersistentTask.register
export class RemoteRoomNeedGenerator extends NeedGeneratorBase<RemoteNeedGeneratorMemory, RemoteNeedGeneratorArgs> {

    protected parentScheduler?: IScheduler | null
    protected parentAnalyst?: RoomAnalyst | null
    protected remoteRoom: IRemoteRoom | undefined
    protected parentRoom: IRoomManager | undefined

    initMemory(args: RemoteNeedGeneratorArgs): RemoteNeedGeneratorMemory {
        return {
            roomName: args.room.name,
            parentRoomName: args.parentRoom.name
        }
    }

    doInit(): void {
        const parentRoom = this.parentRoom = Game.manager.getOwnedRoomManager(this.memory.parentRoomName)
        this.room = this.remoteRoom = parentRoom?.getRemoteRoom(this.memory.roomName)
        this.analyst = this.room?.getRoomAnalyst()
        this.parentScheduler = parentRoom?.getNeedGenerator()
        this.parentAnalyst = parentRoom?.getRoomAnalyst()

        this.initProviders()
    }

    initProviders(): void {
        if(this.room && this.analyst && this.parentScheduler && this.remoteRoom && this.parentAnalyst && this.parentRoom) {
            this.providers.push(
                new ResourcePickupProvider(this.parentScheduler, this.room, this.parentRoom, this.parentAnalyst, true),
                new EmptyContainerNeedProvider(this.parentScheduler, this.room, this.parentRoom, this.analyst, this.parentAnalyst, true),
                new RemoteBuildNeedProvider(this.parentScheduler, this.room, this.analyst, true),
                new MineNeedsProvider(this.parentScheduler, this.analyst, true),
                new ReserveNeedProvider(this.parentScheduler, this.remoteRoom),
                new RestAtSafeZoneNeedGenerator(this.parentScheduler, this.parentAnalyst, true),
            )
        }
    }
}
