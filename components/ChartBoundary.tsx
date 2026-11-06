"use client";
// Keeps a chart failure from taking down the whole page: the chart is replaced by a short note.
import { Component, type ReactNode } from "react";

export default class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        console.error("[chart] failed to render:", error);
    }

    render() {
        if (this.state.failed) return <p className="empty">The chart could not be drawn. The data below is unaffected.</p>;
        return this.props.children;
    }
}
