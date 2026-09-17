// Lets overlay UI (video player, detail screens) claim the hardware/gesture
// back button instead of it falling through to the router or exiting the app.
type Handler = () => void;

const stack: Handler[] = [];

export const BackHandlerStack = {
    push(handler: Handler) {
        stack.push(handler);
    },
    pop(handler: Handler) {
        const idx = stack.lastIndexOf(handler);
        if (idx !== -1) stack.splice(idx, 1);
    },
    handle(): boolean {
        const top = stack[stack.length - 1];
        if (top) {
            top();
            return true;
        }
        return false;
    },
};
