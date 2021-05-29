import { TaskManager } from "TaskManager";
import { counter } from "GlobalCounter";
import { RoomManager } from "tasks/RoomManager";
import { ReservationManager } from "tasks/reservation/ReservationManager";
import { IOwnedRoomManager, IRoomManager } from "interfaces";
import { Logger } from "Logger";

const logger = new Logger('global')
logger.warn('Global reset ...')

export class GameManager {
    private rooms: IOwnedRoomManager[] = []
    private allRooms: IRoomManager[] = []
    private taskManager: TaskManager = new TaskManager();

    run() {
        if(!Memory.config) {
            Memory.config = {
                loggers: {}
            }
        }
        if(!Memory.config.loggers) {
            Memory.config.loggers = {}
        }

        Game.manager = this;

        counter.reset()

        this.cleanupCreeps();

        this.taskManager.loadPersistedTasks()
        this.taskManager.preInit()

        const reservationManagers = this.taskManager.findTasks(ReservationManager)

        if(reservationManagers.length === 0) {
            Game.reservationManager = this.taskManager.scheduleTask(ReservationManager, {})
        }
        else {
            Game.reservationManager = reservationManagers[0]
        }

        const tasks = this.taskManager.findTasks(RoomManager);

        Object.values(Game.rooms).forEach(room => {
            if(room.find(FIND_MY_SPAWNS).length === 0) {
                return
            }

            const roomTask = tasks.find(task => task.name === room.name);

            if(!roomTask) {
                this.taskManager.scheduleTask(RoomManager, {
                    room: room
                })
            }
        })

        this.taskManager.init();

        this.taskManager.run();

        this.taskManager.visualize();

        this.taskManager.finalize()
    }

    cleanupCreeps() {
        for (const name in Memory.creeps) {
            if (!(name in Game.creeps)) {
                logger.info("Creep", name, "died!");
                delete Memory.creeps[name];
            }
          }
    }

    getOwnedRoomManager(roomName: string) {
        return this.rooms.find(mgr => mgr.name === roomName)
    }

    registerOwnedRoomManager(manager: IOwnedRoomManager) {
        this.rooms.push(manager)
        this.allRooms.push(manager)
    }

    getRoomManager(roomName: string) {
        return this.allRooms.find(mgr => mgr.name === roomName)
    }

    registerRoomManager(manager: IRoomManager) {
        this.allRooms.push(manager)
    }
}
