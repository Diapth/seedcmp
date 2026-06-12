export async function runTextPostSendEffects({
  conversation = null,
  content = '',
  localMessage = null,
  mentions = [],
  createCoordinatorTemplateCatsCard,
  handleProjectGroupTextFallback,
  startAgentPendingFeedback,
  createProjectGroupCard,
  createDeploymentCard
} = {}) {
  await createCoordinatorTemplateCatsCard?.(conversation, content, localMessage);

  const projectGroupCard = createProjectGroupCard?.(conversation, content, localMessage);
  const projectGroupCardCreated = Boolean(projectGroupCard);

  if (!projectGroupCardCreated) {
    const handledProjectGroupFallback = await handleProjectGroupTextFallback?.(conversation, content);
    if (handledProjectGroupFallback) {
      return {
        projectGroupCardCreated: false,
        handledProjectGroupFallback: true,
        shouldReturn: true
      };
    }
  }

  if (projectGroupCardCreated) {
    startAgentPendingFeedback?.(conversation, localMessage, mentions);
    await createDeploymentCard?.(conversation, content, localMessage);
    return {
      projectGroupCardCreated: true,
      handledProjectGroupFallback: false,
      shouldReturn: false
    };
  }

  startAgentPendingFeedback?.(conversation, localMessage, mentions);
  await createDeploymentCard?.(conversation, content, localMessage);

  return {
    projectGroupCardCreated: false,
    handledProjectGroupFallback: false,
    shouldReturn: false
  };
}
