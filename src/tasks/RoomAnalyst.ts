import { RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { getPositionsAround } from "../utils/MapUtils"
import { packPos, unpackPos } from "../utils/packrat"
import { isBuildable, notEmpty } from "utils/common";
import { CREEP_ROLE_MINER, CREEP_ROLE_HAULER } from "../constants";
import { flagSelectors } from "../utils/common"
import { Logger } from "Logger";

interface RoomAnalystMemory {
    roomName: string,
    miningSites?: MiningSiteMemory[]
    safeSources?: Id<Source>[]
    constructionSites?: Id<ConstructionSite>[]
    spawns?: Id<StructureSpawn>[]
    extensions?: Id<StructureExtension>[]
    extensionClusters?: {
        center: string,
        spots: string[],
        extensionsIds: Id<StructureExtension>[]
    }[],
    storage?: {
        location: string
        containerId?: Id<StructureContainer>
        id?: Id<StructureStorage>
    },
    toRepair?: {
        id: Id<Structure>
        percent: number
    }[]
    towers?: Id<StructureTower>[]
    expansionDirections?: string[]
}

interface MiningSiteMemory {
    sourceId: Id<Source>
    containerId?: Id<StructureContainer>
    containerPos: string
}

interface RoomAnalystArgs {
    roomName: string
}

interface MiningSite {
    source: Source
    container?: StructureContainer | null
    containerPos: RoomPosition
}

export class ExtensionCluster {
    public id: string

    constructor(
        public center: RoomPosition,
        public freeSpots: RoomPosition[],
        public extensions: StructureExtension[],
    ) {
        this.id = 'extension-'+packPos(this.center)
    }

    getMissingEnergyAmount() {
        return this.extensions
            .map(extension => extension.store.getFreeCapacity(RESOURCE_ENERGY) || 0)
            .reduce((sum, current) => sum + current, 0)
    }

    getExtensionsMissingEnergy() {
        return this.extensions.filter(ext => ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
    }

    toString() {
        return `[ExtensionCluster center=${this.center} extensions=${this.extensions.length}]`
    }
}

export class RoomStorageWrapper {

    constructor(
        public location: RoomPosition,
        public container?: StructureContainer | null,
        public storage?: StructureStorage | null
    ) {}

    isConstructed() {
        return !!this.container || !!this.storage
    }

    getResourceAmount(resource: ResourceConstant): number {
        if(this.container) {
            return this.container.store[resource]
        }
        if(this.storage) {
            return this.storage.store[resource]
        }

        return 0
    }

    getCapacity() {
        if(this.container) {
            return this.container.store.getCapacity()
        }

        if(this.storage) {
            return this.storage.store.getCapacity()
        }

        return 0
    }

    isFull() {
        if(!this.storage && !this.container) {
            return false
        }

        return this.getResourceAmount(RESOURCE_ENERGY) === this.getCapacity()
    }

    isEmpty() {
        if(!this.storage && !this.container) {
            const resources = this.location.lookFor(LOOK_RESOURCES)
            for(let res of resources) {
                if(res.amount > 0) {
                    return false
                }
            }
            return true
        }

        return this.getResourceAmount(RESOURCE_ENERGY) === 0
    }
}

@PersistentTask.register
export class RoomAnalyst extends PersistentTask<RoomAnalystMemory, RoomAnalystArgs> {

    private room: Room
    private miningSites: MiningSite[]
    private safeSources: Source[]
    private constructionSites: ConstructionSite[]
    private spawns: StructureSpawn[]
    private extensions: StructureExtension[]
    private extensionClusters: ExtensionCluster[]
    private creeps: Creep[]
    private toRepair: Structure[]
    private towers: StructureTower[]

    private storage?: RoomStorageWrapper | null

    private logger = new Logger('RoomAnalyst')

    initMemory(args: RoomAnalystArgs): RoomAnalystMemory {
        return {
            roomName: args.roomName,
        }
    }

    doPreInit(): void {
        this.room = Game.rooms[this.memory.roomName]

        this.miningSites = []
        for(const site of (this.memory.miningSites || [])) {
            const source = Game.getObjectById(site.sourceId);

            if(!source) {
                continue
            }

            this.miningSites.push({
                source: source,
                container: site.containerId ? Game.getObjectById(site.containerId) : null,
                containerPos: unpackPos(site.containerPos)
            })
        }

        this.safeSources = this.memory.safeSources
            ?.map(source => Game.getObjectById(source))
            ?.filter(notEmpty) || []

        this.constructionSites = this.memory.constructionSites
            ?.map(siteId => Game.getObjectById(siteId))
            ?.filter(notEmpty) || []

        this.spawns = this.memory.spawns
            ?.map(spawnId => Game.getObjectById(spawnId))
            .filter(notEmpty) || []

        this.extensions = this.memory.extensions
            ?.map(extensionId => Game.getObjectById(extensionId))
            ?.filter(notEmpty) || []

        this.extensionClusters = this.memory.extensionClusters?.map(cluster => {
            return new ExtensionCluster(
                unpackPos(cluster.center),
                cluster.spots.map(pos => unpackPos(pos)),
                cluster.extensionsIds.map(id => Game.getObjectById(id)).filter(notEmpty)
            )
        }) || []

        this.toRepair = this.memory.toRepair
            ?.sort((a, b) => a.percent - b.percent)
            ?.map(data => Game.getObjectById(data.id))
            ?.filter(notEmpty) || []

        this.towers = this.memory.towers
            ?.map(towerId => Game.getObjectById(towerId))
            .filter(notEmpty) || []

        if(this.memory.storage) {
            this.storage = new RoomStorageWrapper(
                unpackPos(this.memory.storage.location),
                this.memory.storage.containerId ? Game.getObjectById(this.memory.storage.containerId) : null,
                this.memory.storage.id ? Game.getObjectById(this.memory.storage.id) : null
            )
        }

        if(this.room) {
            this.creeps = this.room.find(FIND_MY_CREEPS)
        }
        else {
            this.creeps = []
        }
    }

    doInit() {}

    doRun(): RunResultType {
        if(!this.room) {
            this.logger.important(this, 'NOT running analysis - no room available')
            this.sleep(15)
            return
        }

        this.logger.important(this, 'Running analysis ...')

        this.analyzeStorage()
        this.analyzeSources()
        this.analyzeMiningSites()
        this.analyzeConstructionSites()
        this.analyzeTowers()
        this.analyzeSpawns()
        this.analyzeExtensions()
        this.analyzeExtensionClusters()
        this.analyzeRepairableObjects()
        this.analyzeExpansionDirections()

        this.sleep(15)
    }

    private analyzeStorage() {
        if(this.room.storage) {
            this.memory.storage = {
                location: packPos(this.room.storage.pos),
                id: this.room.storage.id,
            }
        }
        else {
            const storageFlag = Object.values(Game.flags).find(flag =>
                flag.pos.roomName === this.room.name && flag.color === COLOR_YELLOW && flag.secondaryColor == COLOR_YELLOW
            )

            if(storageFlag) {
                const containers = storageFlag.pos.findInRange<StructureContainer>(FIND_STRUCTURES, 1, {
                    filter: struct => struct.structureType === STRUCTURE_CONTAINER
                })
                this.memory.storage = {
                    location: packPos(storageFlag?.pos)
                }
                if(containers.length > 0) {
                    this.memory.storage.containerId = containers[0].id
                }
            }
        }
    }

    private analyzeSources() {
        const sources = this.room.find(FIND_SOURCES)
        const safeSources = sources.filter(
            source => source.pos.findInRange(FIND_HOSTILE_STRUCTURES, 5).length === 0
        )

        this.memory.safeSources = safeSources.map(source => source.id)
    }

    private analyzeMiningSites() {
        const spawn = this.room.find(FIND_MY_SPAWNS)[0];
        let roadsPos: RoomPosition

        if(spawn) {
            roadsPos = spawn.pos
        }
        else {
            if(this.room.controller) {
                roadsPos = this.room.controller.pos
            }
            else {
                roadsPos = new RoomPosition(25, 25, this.memory.roomName)
            }
        }

        const newSites: MiningSite[] = [];

        this.safeSources.forEach(source => {
            const existingContainers = source.pos.findInRange<StructureContainer>(FIND_STRUCTURES, 1, {
                filter: obj => obj.structureType == STRUCTURE_CONTAINER
            })

            if(existingContainers.length > 0) {
                const existingContainer = existingContainers[0]

                newSites.push({
                    source: source,
                    containerPos: existingContainer.pos,
                    container: existingContainer
                })

                return
            }

            const containerBuildSites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                filter: site => site.structureType === STRUCTURE_CONTAINER
            })

            if(containerBuildSites.length > 0) {
                const containerBuildSite = containerBuildSites[0]

                newSites.push({
                    source: source,
                    containerPos: containerBuildSite.pos,
                })

                return
            }

            const validPositions = getPositionsAround(source.pos).filter(pos => {
                const elements = pos.look()

                for(const item of elements) {
                    if(item.terrain === "wall") {
                        return false
                    }
                    if(item.constructionSite && item.constructionSite.structureType !== STRUCTURE_CONTAINER) {
                        return false
                    }
                }

                return true
            }).map(pos => {
                return {
                    pos: pos,
                    distance: pos.findPathTo(roadsPos).length
                }
            }).sort((a, b) => {
                return a.distance - b.distance
            });

            if(validPositions.length > 0) {
                const siteContainerPos = validPositions[0].pos;
                const containers = source.pos.findInRange<StructureContainer>(FIND_MY_STRUCTURES, 1, {
                    filter: obj => obj.structureType == STRUCTURE_CONTAINER
                })

                newSites.push({
                    source: source,
                    containerPos: siteContainerPos,
                    container: containers[0]
                })
            }
        })

        this.miningSites = newSites
        this.memory.miningSites = newSites.map(site => {
            return {
                sourceId: site.source.id,
                containerPos: packPos(site.containerPos),
                containerId: site.container?.id
            }
        })
    }

    private analyzeConstructionSites() {
        this.constructionSites = this.room.find(FIND_CONSTRUCTION_SITES)
        this.memory.constructionSites = this.constructionSites.map(site => site.id)
    }

    private analyzeTowers() {
        this.towers = this.room.find<StructureTower>(FIND_MY_STRUCTURES, {
            filter: obj => obj.structureType === STRUCTURE_TOWER
        })
        this.memory.towers = this.towers.map(tower => tower.id)
    }

    private analyzeSpawns() {
        this.spawns = this.room.find<StructureSpawn>(FIND_MY_STRUCTURES, {
            filter: obj => obj.structureType === STRUCTURE_SPAWN
        })
        this.memory.spawns = this.spawns.map(spawn => spawn.id)
    }

    private analyzeExtensions() {

        const extensions = this.room.find<StructureExtension>(FIND_MY_STRUCTURES, {
            filter: struct => struct.structureType === STRUCTURE_EXTENSION
        });
        this.memory.extensions = extensions.map(ext => ext.id)
    }

    private analyzeExtensionClusters() {
        const clusterFlags = Object.values(Game.flags).filter(flag =>
            flag.pos.roomName === this.room.name && flag.color === COLOR_YELLOW && flag.secondaryColor === COLOR_GREEN
        )

        this.extensionClusters = clusterFlags.map(flag => {
            const alignTarget = new RoomPosition(flag.pos.x, Math.max(0, flag.pos.y-5), flag.pos.roomName)

            const freeSpots = getPositionsAround(flag.pos).filter(pos => {
                const elements = pos.look()

                for(const item of elements) {
                    if(item.terrain === "wall") {
                        return false
                    }
                    if(item.constructionSite && item.constructionSite.structureType !== STRUCTURE_EXTENSION) {
                        return false
                    }
                }

                return true
            })
            .map(pos => {
                return {
                    pos: pos,
                    distance: pos.getRangeTo(alignTarget)
                }
            })
            .sort((a, b) => {
                return b.distance - a.distance
            })
            .slice(0, 5)
            .filter(spot => isBuildable(spot.pos))

            const extensions = flag.pos.findInRange<StructureExtension>(FIND_MY_STRUCTURES, 1, {
                filter: obj => obj.structureType === STRUCTURE_EXTENSION
            })

            return new ExtensionCluster(flag.pos, freeSpots.map(spot => spot.pos), extensions)
        })

        this.memory.extensionClusters = this.extensionClusters.map(cluster => {
            return {
                center: packPos(cluster.center),
                spots: cluster.freeSpots.map(pos => packPos(pos)),
                extensionsIds: cluster.extensions.map(ext => ext.id)
            }
        })
    }

    private analyzeRepairableObjects() {
        const toRepair = this.room.find(FIND_STRUCTURES)

        this.memory.toRepair = toRepair
            .filter(obj => (obj.hits/obj.hitsMax) < 0.8)
            .map(obj => {
                return {
                    id: obj.id,
                    percent: obj.hits/obj.hitsMax
                }
            })
            .sort((a, b) => a.percent - b.percent)
            .slice(0, 30)
    }

    private analyzeExpansionDirections() {
        const flags = Object.values(Game.flags)
            .filter(flag => flag.pos.roomName === this.room.name)
            .filter(flagSelectors.isExpansionFlag)

        const roomExits = Game.map.describeExits(this.room.name)
        this.memory.expansionDirections = flags
            .map(flag => {
                if(flag.pos.x === 0) {
                    return FIND_EXIT_LEFT
                }
                if(flag.pos.y === 0) {
                    return FIND_EXIT_TOP
                }
                if(flag.pos.x === 49) {
                    return FIND_EXIT_RIGHT
                }
                if(flag.pos.y === 49) {
                    return FIND_EXIT_BOTTOM
                }

                return null
            })
            .filter(notEmpty)
            .map(exitCode => {
                const exitStrCode = exitCode.toString() as ExitKey
                return roomExits[exitStrCode]
            })
            .filter(notEmpty)

        this.logger.debug(this, 'Expansion directions:', this.memory.expansionDirections)
    }

    doVisualize() {
        for(const site of this.miningSites) {
            this.room.visual.circle(site.containerPos)
            if(site.container) {
                const reservations = Game.reservationManager.getHandler(site.container)

                if(reservations && reservations.getReservedAmount() > 0) {
                    const msg = `${reservations.getReservedAmount()}/${site.container.store.getUsedCapacity()}`
                    this.room.visual.text(msg, site.source.pos, {
                        stroke: 'black',
                        color: 'white',
                    })
                }
            }
        }

        for(const cluster of this.extensionClusters) {
            for(const spot of cluster.freeSpots) {
                this.room.visual.circle(spot, {
                    fill: 'yellow'
                })
            }
        }

        for(const source of this.safeSources) {
            this.room.visual.circle(source.pos, {
                fill: "green"
            })
        }

        for(const toRepair of this.toRepair) {
            this.room.visual.circle(toRepair.pos, {
                fill: 'red'
            })
        }
    }

    getRCL() {
        return this.room.controller?.level || 0
    }

    getStorage() {
        return this.storage
    }

    getMiningSites() {
        return this.miningSites
    }

    getConstructionSites() {
        return this.constructionSites
    }

    getSafeSources() {
        return this.safeSources
    }

    getSpawns() {
        return this.spawns
    }

    getExtensions() {
        return this.extensions
    }

    getTowers() {
        return this.towers
    }

    getExtensionClusters() {
        return this.extensionClusters
    }

    getToRepair() {
        return this.toRepair
    }

    getDroppedResources() {
        return this.room
            .find(FIND_DROPPED_RESOURCES)
            .filter(res => res.amount > 100)
    }

    getExpansionDirections() {
        return this.memory.expansionDirections || []
    }

    isRoomAtCritical() {
        const miners = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_MINER).length
        const haulers = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_HAULER).length
        return miners < 1 || haulers < 1
    }

    invalidateConstructionSites() {
        // this.analyzeConstructionSites()
        this.wakeUp()
    }

    toString() {
        return `[RoomAnalyst ${this.memory.roomName}]`
    }
}
