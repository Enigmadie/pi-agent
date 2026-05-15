export type ApprovalState = "pending" | "approved" | "rejected" | "expired";

export type PendingApproval = {
  id: string;
  action: string;
  createdAt: Date;
  state: ApprovalState;
};
