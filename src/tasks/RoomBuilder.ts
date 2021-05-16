import { RunResultType } from "./AbstractTask";
import { RoomManager } from "./RoomManager";
import { PersistentTask } from "./PersistentTask";
import { RoomAnalyst } from "./RoomAnalyst";
import { getPositionsAround } from "utils/MapUtils";
import { isBuildable } from "utils/common";
import { Logger } from "Logger";

interface RoomBuilderMemory {
    roomName: string
}

interface RoomBuilderArgs {
    room: RoomManager
}

const MAX_ROAD_CONSTRUCTION_SITES = 5

@PersistentTask.register
export class RoomBuilder extends PersistentTask<RoomBuilderMemory, RoomBuilderArgs> {
    private analyst?: RoomAnalyst
    private room: Room

    private logger = new Logger('RoomBuilder')

    initMemory(args: RoomBuilderArgs): RoomBuilderMemory {
        return {
            roomName: args.room.name
        }
    }
    doInit(): void {
        this.room = Game.rooms[this.memory.roomName]
    }

    doRun(): RunResultType {
        if(!this.analyst) {
            this.logger.warn("NO ANALYST :(")
            this.sleep(3)
            return
        }

        const storageInConstruction = this.analyst.getConstructionSites().filter(site => site.structureType === STRUCTURE_STORAGE).length > 0

        if(!storageInConstruction) {
            this.logger.important(this, 'running ...')
            const storageStarted = this.buildStorage(this.analyst)

            if(storageStarted) {
                return
            }

            this.buildMiningSiteContainers(this.analyst)
            this.buildExtensions(this.analyst)
            this.buildRoads(this.analyst)
        }
        else {
            this.logger.important(this, 'not running - storage in construction')
        }

        this.sleep(10)
    }

    private buildStorage(analyst: RoomAnalyst) {
        const storageData = analyst.getStorage()
        if(storageData) {
            if(this.room.controller && CONTROLLER_STRUCTURES[STRUCTURE_STORAGE][this.room.controller.level] > 0) {

                const validPositions = getPositionsAround(storageData.location)

                for(const pos of validPositions) {
                    const result = pos.createConstructionSite(STRUCTURE_STORAGE)
                    if(result === OK) {
                        analyst.invalidateConstructionSites()
                        return true
                    }
                }
            }
            else {
                const result = storageData.location.createConstructionSite(STRUCTURE_CONTAINER)
            }
        }

        return false
    }

    private buildMiningSiteContainers(analyst: RoomAnalyst) {
        const sites = analyst.getMiningSites()
        for(const site of sites) {
            if(!site.container) {
                site.containerPos.createConstructionSite(STRUCTURE_CONTAINER)
            }
        }
    }

    private buildExtensions(analyst: RoomAnalyst) {
        if(!this.room.controller) {
            return
        }

        const clusters = analyst.getExtensionClusters()

        if(clusters.length === 0) {
            return
        }

        const extensions = analyst.getExtensions()

        const exisingExtensionsAmount = extensions.length

        const extensionsInConstruction = analyst.getConstructionSites().filter(site => site.structureType === STRUCTURE_EXTENSION).length

        const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][this.room.controller.level]

        let toPlaceExtensions = maxExtensions - exisingExtensionsAmount - extensionsInConstruction

        if(toPlaceExtensions <= 0) {
            return
        }

        let placedExtensions = 0

        for(const cluster of clusters) {
            for(const spot of cluster.freeSpots) {

                if(!isBuildable(spot)) {
                    continue
                }

                const result = spot.createConstructionSite(STRUCTURE_EXTENSION)

                if(result === OK) {
                    placedExtensions++
                }

                if(placedExtensions >= toPlaceExtensions) {
                    break
                }
            }
            if(placedExtensions >= toPlaceExtensions) {
                break
            }
        }

        if(placedExtensions > 0) {
            analyst.invalidateConstructionSites()
        }
    }

    private buildRoads(analyst: RoomAnalyst) {
        const activeConstructions = analyst.getConstructionSites().length
        const roadsToBuild = MAX_ROAD_CONSTRUCTION_SITES - activeConstructions

        const storage = analyst.getStorage()
        const controller = this.room.controller

        if(roadsToBuild <= 0 || !storage || !controller) {
            return
        }

        const builder = new RoadBuilder(roadsToBuild)

        const sites = analyst.getMiningSites()

        for(const site of sites) {
            builder.buildRoad(() => builder.createRoad(storage.location, site.containerPos, {
                maximumSteps: builder.roadsLeft
            }))
        }

        builder.buildRoad(() => builder.createRoad(storage.location, controller.pos, {
            maximumSteps: builder.roadsLeft,
            cutoff: 3,
        }))

        if(builder.constructedRoads > 0) {
            analyst.invalidateConstructionSites()
        }
    }

    setAnalyst(anaylst: RoomAnalyst) {
        this.analyst = anaylst
    }

    toString() {
        return `[RoomBuilder ${this.memory.roomName}]`
    }
}

interface CreateRoadOptions {
    maximumSteps: number
    cutoff?: number
}

class RoadBuilder {
    public constructedRoads: number = 0
    public roadsLeft = 0
    constructor(private maxSites: number) {
        this.roadsLeft = maxSites
    }

    buildRoad(callback: () => number) {
        if(this.constructedRoads <= this.maxSites) {
            this.constructedRoads += callback()
        }
    }

    createRoad(from: RoomPosition, to: RoomPosition, options: CreateRoadOptions) {
        let path = from.findPathTo(to, {
            ignoreCreeps: true
        })

        if(options.cutoff) {
            path = path.slice(0, -1*options.cutoff)
        }

        let constructedRoads = 0

        for(const step of path) {
            const pos = new RoomPosition(step.x, step.y, from.roomName)
            const result = pos.createConstructionSite(STRUCTURE_ROAD)
            if(result === OK) {
                constructedRoads++
            }

            if(constructedRoads > options.maximumSteps) {
                break
            }
        }

        return constructedRoads
    }
}
