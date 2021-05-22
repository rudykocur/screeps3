import { RunResult, RunResultType } from "tasks/AbstractTask";
import { PersistentTask } from "tasks/PersistentTask";
import { RoomAnalyst } from "tasks/RoomAnalyst";
import { BuildNeedProvider, RepairNeedsProvider } from "./BuilderNeeds";
import { ResourcePickupAtCriticalProvider, ResourcePickupProvider } from "./ResourceNeeds";
import { EmptyContainerAtCriticalNeedProvider, EmptyContainerNeedProvider, EmptyRuinNeedProvider, EmptyTombstoneNeedProvider } from "./EmptyContainersNeeds";
import { MineNeedsProvider } from "./MineNeeds";
import { GenericNeedsProvider, HarvestEnergyAtCriticalNeedsProvider } from "./GenericNeeds";
import { EnergyRefillAtCriticalNeedProvider, EnergyRefillNeedsProvider, ExtensionClusterNeedsProvider, SpawnRefillAtCriticalNeedProvider, SpawnRefillNeedsProvider, TowerRefillNeedsProvider } from "./EnergyRefillNeeds";
import { IRoomManager } from "interfaces";
import { INeedGenerator, Need, NeedPriority, NeedsProvider } from "./interfaces";
import { Logger } from "Logger";
import _ from "lodash"
import { CreepRole } from "../constants";

interface NeedGeneratorMemory {
    roomName: string
}

interface NeedGeneratorArgs {
    room: IRoomManager
}

export abstract class NeedGeneratorBase extends PersistentTask<NeedGeneratorMemory, NeedGeneratorArgs> implements INeedGenerator {

    protected room?: IRoomManager | null
    protected analyst?: RoomAnalyst | null
    private _needs?: Need[]
    protected providers: NeedsProvider[] = []

    protected logger = new Logger('NeedGenerator')

    protected priorityOrder = [NeedPriority.CRITICAL, NeedPriority.HIGH, NeedPriority.NORMAL, NeedPriority.LOW, NeedPriority.LAST]

    initMemory(args: NeedGeneratorArgs): NeedGeneratorMemory {
        return {
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.room = Game.manager.getRoomManager(this.memory.roomName)
        this.analyst = this.room?.getRoomAnalyst()

        this.initProviders()
    }

    abstract initProviders(): void

    doRun(): RunResultType {
        if(!this.room || !this.analyst) {
            return RunResult.DONE
        }
    }

    assignTasks(actors: Creep[]) {
        if(actors.length === 0) {
            return
        }

        const role = actors[0].memory.role

        const tasks = this.getChildTasks()

        const jobless = actors.filter(creep =>
            tasks.find(job => {
                if(!('getActorId' in job)) {
                    this.logger.error(`Task ${job} does not have actorId!!!`)
                }
                return 'getActorId' in job && job.getActorId() === creep.id
            }) === undefined
        )

        if(jobless.length === 0) {
            return
        }

        const needs = this.generateNeeds()

        this.logger.debug(this, `assigning tasks actors=${jobless.length} role=${role} needs=${needs.length} `)

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

                selectedNeed = this.findNeed(needsAtLevel, actor, role)

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

    findNeed(needs: Need[], actor: Creep, role: CreepRole) {
        const applicableNeeds = needs.filter(need => need.roles.indexOf(role) >= 0)
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
            this.logger.debug(this, "Generating needs")
            this._needs = this.providers
                .filter(provider => provider.isActive())
                .map(provider => provider.generate()).reduce((a, b) => a.concat(b));
        }

        return this._needs
    }

    toString() {
        return `[NeedGenerator ${this.room}]`
    }
}

@PersistentTask.register
export class NeedGenerator extends NeedGeneratorBase {
    initProviders(): void {
        if(this.room && this.analyst) {
            this.providers.push(
                new ResourcePickupProvider(this, this.room, this.analyst),
                new EmptyContainerNeedProvider(this, this.room, this.analyst),
                new SpawnRefillNeedsProvider(this, this.room, this.analyst),
                new SpawnRefillAtCriticalNeedProvider(this, this.room, this.analyst),
                new EnergyRefillNeedsProvider(this, this.room, this.analyst),
                new TowerRefillNeedsProvider(this, this.room, this.analyst),
                new ExtensionClusterNeedsProvider(this, this.room, this.analyst),
                new MineNeedsProvider(this, this.analyst),
                new BuildNeedProvider(this, this.room, this.analyst),
                new RepairNeedsProvider(this, this.room, this.analyst),
                new GenericNeedsProvider(this, this.room, this.analyst),
                new EmptyTombstoneNeedProvider(this, this.room, this.analyst),
                new EmptyRuinNeedProvider(this, this.room, this.analyst),
                new EmptyContainerAtCriticalNeedProvider(this, this.room, this.analyst),
                new EnergyRefillAtCriticalNeedProvider(this, this.room, this.analyst),
                new ResourcePickupAtCriticalProvider(this, this.room, this.analyst),
                new HarvestEnergyAtCriticalNeedsProvider(this, this.room, this.analyst)
            )
        }
    }
}

@PersistentTask.register
export class RemoteRoomNeedGenerator extends NeedGeneratorBase {
    initProviders(): void {
        if(this.room && this.analyst) {
            this.providers.push(
                // new ResourcePickupProvider(this, this.room, this.analyst),
                // new EmptyContainerNeedProvider(this, this.room, this.analyst),
                new MineNeedsProvider(this, this.analyst),
            )
        }
    }
}
