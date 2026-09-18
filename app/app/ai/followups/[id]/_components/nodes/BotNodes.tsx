"use client";

import type { NodeProps } from "@xyflow/react";

import type { NodeType } from "@/lib/followup/graph-schema";
import { nodeBranches } from "@/lib/followup/graph-schema";
import type { RFNode } from "@/lib/followup/graph-mappers";
import type { ConfigOf } from "../forms/shared";
import { NODE_VISUALS, describeNodeConfig } from "./nodeVisuals";
import { NodeCard } from "./NodeCard";

function ramosDoNo(type: NodeType, config: RFNode["data"]["config"]) {
  if (type === "menu") return nodeBranches({ type, config: config as ConfigOf<"menu"> });
  if (type === "faq") return nodeBranches({ type, config: config as ConfigOf<"faq"> });
  if (type === "horario") return nodeBranches({ type, config: config as ConfigOf<"horario"> });
  return undefined;
}

function BotNode({ type, id, data, selected }: NodeProps<RFNode> & { type: NodeType }) {
  return (
    <NodeCard
      id={id}
      visual={NODE_VISUALS[type]}
      label={data.label}
      subtitle={describeNodeConfig(type, data.config)}
      selected={selected}
      errors={data.errors}
      branches={ramosDoNo(type, data.config)}
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
