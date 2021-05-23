import { CreepRole, CREEP_ROLE_RESERVE } from "../constants";
import { IRemoteRoom, IScheduler } from "interfaces";
import { Need, NeedPriority, NeedsProvider } from "./interfaces";
import { ReserveRoom } from "tasks/creeps/ReserveRoom";

export class ReserveNeedProvider implements NeedsProvider {
    constructor(
        private scheduler: IScheduler,
        private room: IRemoteRoom,
    ) {}

    generate(): Need[] {
        return [
            new ReserveNeed(this.scheduler, this.room)
        ]
    }

    isActive(): boolean {
        return true
    }
}

export class ReserveNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_RESERVE]
    infinite = false
    priority = NeedPriority.NORMAL

    remote: boolean = true

    constructor(
        private scheduler: IScheduler,
        private room: IRemoteRoom
    ) {}

    generate(actor: Creep) {
        this.scheduler.scheduleBackgroundTask(ReserveRoom, {
            actor: actor,
            room: this.room
        })
    }

    calculateCost() {
        return 0
    }

    toString() {
        return `[ReserveNeed]`
    }
}
