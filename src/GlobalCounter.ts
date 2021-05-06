class GlobalCounter {
    private counter = 0;
    private tick = 0;

    reset() {
        this.counter = 0;
        this.tick = Game.time;
    }

    generate() {
        return this.tick + '-' + (this.counter++)
    }
}

export const counter = new GlobalCounter();
