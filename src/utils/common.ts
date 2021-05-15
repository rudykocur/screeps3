export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

export function isBuildable(pos: RoomPosition): boolean {
    const elements = pos.look()

    for(const item of elements) {
        if(item.terrain === "wall") {
            return false
        }
        if(item.structure) {
            return false
        }
        if(item.constructionSite) {
            return false
        }
    }

    return true
}
