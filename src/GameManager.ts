import { TaskManager } from "TaskManager";
import { counter } from "GlobalCounter";
import { RoomManager } from "tasks/RoomManager";
import { ReservationManager } from "tasks/reservation/ReservationManager";

export class GameManager {
    private rooms: RoomManager[];
    private taskManager: TaskManager = new TaskManager();

    constructor() {
        this.rooms = [];
    }

    run() {
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
                console.log("Skipping unowned room", room);
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
    }

    cleanupCreeps() {
        for (const name in Memory.creeps) {
            if (!(name in Game.creeps)) {
                console.log("Creep", name, "died!");
                delete Memory.creeps[name];
            }
          }
    }

    getRoomManager(roomName: string) {
        return this.rooms.find(mgr => mgr.name === roomName)
    }

    registerRoomManager(manager: RoomManager) {
        this.rooms.push(manager)
    }
}
