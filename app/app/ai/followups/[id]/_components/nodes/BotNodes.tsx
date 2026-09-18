"use client";

import type { NodeProps } from "@xyflow/react";

import type { NodeType } from "@/lib/followup/graph-schema";
import type { RFNode } from "@/lib/followup/graph-mappers";
import { NODE_VISUALS, describeNodeConfig } from "./nodeVisuals";
import { NodeCard } from "./NodeCard";

function BotNode({ type, id, data, selected }: NodeProps<RFNode> & { type: NodeType }) {
  return (
    <NodeCard
      id={id}
      visual={NODE_VISUALS[type]}
      label={data.label}
      subtitle={describeNodeConfig(type, data.config)}
      selected={selected}
      errors={data.errors}
    />
  );
}

export function MenuNode(props: NodeProps<RFNode>) {
  return <BotNode {...props} type="menu" />;
}
export function FaqNode(props: NodeProps<RFNode>) {
  return <BotNode {...props} type="faq" />;
}
export function HorarioNode(props: NodeProps<RFNode>) {
  return <BotNode {...props} type="horario" />;
}
export function HumanoNode(props: NodeProps<RFNode>) {
  return <BotNode {...props} type="humano" />;
}
export function AssistenteNode(props: NodeProps<RFNode>) {
  return <BotNode {...props} type="assistente" />;
}
