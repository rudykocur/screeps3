import { RunResultType } from "./AbstractTask";
import { RoomManager } from "./RoomManager";
import { PersistentTask } from "./PersistentTask";
import { getPositionsAround } from "../utils/MapUtils"
import { packPos, unpackPos } from "../utils/packrat"
import { notEmpty } from "utils/common";

interface RoomAnalystMemory {
    roomName: string,
    miningSites?: MiningSiteMemory[]
    sources?: Id<Source>[]
    safeSources?: Id<Source>[]
    constructionSites?: Id<ConstructionSite>[]
    storage?: {
        location: string
        containerId?: Id<StructureContainer>
        id?: Id<StructureStorage>
    }
}

interface MiningSiteMemory {
    sourceId: Id<Source>
    containerId?: Id<StructureContainer>
    containerPos: string
}

interface RoomAnalystArgs {
    room: RoomManager
}

interface MiningSite {
    source: Source
    container?: StructureContainer | null
    containerPos: RoomPosition
}

@PersistentTask.register
export class RoomAnalyst extends PersistentTask<RoomAnalystMemory, RoomAnalystArgs> {

    private room: Room
    private miningSites: MiningSite[]
    private sources: Source[]
    private safeSources: Source[]
    private constructionSites: ConstructionSite[]

    private storage?: {
        location: RoomPosition,
        container?: StructureContainer | null
        storage?: StructureStorage | null
    }

    initMemory(args: RoomAnalystArgs): RoomAnalystMemory {
        return {
            roomName: args.room.name,
        }
    }

    doInit(): void {
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

        if(this.memory.storage) {
            this.storage = {
                location: unpackPos(this.memory.storage.location),
                container: this.memory.storage.containerId ? Game.getObjectById(this.memory.storage.containerId) : null,
                storage: this.memory.storage.id ? Game.getObjectById(this.memory.storage.id) : null
            }
        }
    }

    doRun(): RunResultType {
        console.log(this, 'Running analysis ...')

        this.analyzeStorage()
        this.analyzeSources()
        this.analyzeMiningSites()
        this.analyzeConstructionSites()

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

        this.memory.sources = sources.map(source => source.id)
        this.memory.safeSources = safeSources.map(source => source.id)
    }

    private analyzeMiningSites() {
        const spawn = this.room.find(FIND_MY_SPAWNS)[0];

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
                    distance: pos.findPathTo(spawn.pos).length
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
        this.memory.constructionSites = this.room.find(FIND_CONSTRUCTION_SITES).map(site => site.id)
    }

    doVisualize() {
        for(const site of this.miningSites) {
            this.room.visual.circle(site.containerPos)
        }

        for(const source of this.safeSources) {
            this.room.visual.circle(source.pos, {
                fill: "green"
            })
        }
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

    toString() {
        return `[RoomAnalyst ${this.room.name}]`
    }
}
