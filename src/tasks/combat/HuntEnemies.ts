import { TaskWithActor } from "TaskManager";
import { RunResult, RunResultType } from "tasks/AbstractTask";
import { PersistentTask } from "tasks/PersistentTask";
import { notEmpty } from "utils/common";


interface HuntEnemiesMemory {
    actorId: Id<Creep>
    enemiesIds: Id<Creep>[]
}

interface HuntEnemiesArgs {
    actor: Creep
    enemies: Creep[]
}

@PersistentTask.register
export class HuntEnemies extends PersistentTask<HuntEnemiesMemory, HuntEnemiesArgs> implements TaskWithActor {

    private actor?: Creep | null
    private enemies: Creep[]

    initMemory(args: HuntEnemiesArgs): HuntEnemiesMemory {
        return {
            actorId: args.actor.id,
            enemiesIds: args.enemies.map(enemy => enemy.id)
        }
    }
    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        this.enemies = this.memory.enemiesIds.map(enemyId => Game.getObjectById(enemyId)).filter(notEmpty)
    }
    doRun(): RunResultType {
        if(!this.actor || this.enemies.length === 0) {
            return RunResult.DONE
        }

        const enemy = this.enemies[0]

        if(this.actor.pos.isNearTo(enemy)) {
            this.actor.attack(enemy)
        }
        else {
            this.actor.moveTo(enemy)
        }

        this.actor.rangedAttack(enemy)
    }

    getActorId() {
        return this.actor?.id
    }
}
