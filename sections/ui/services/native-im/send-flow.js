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
        result: handledProjectGroupFallback,
        shouldSend: false,
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
      shouldSend: true,
      shouldReturn: false
    };
  }

  startAgentPendingFeedback?.(conversation, localMessage, mentions);
  await createDeploymentCard?.(conversation, content, localMessage);

  return {
    projectGroupCardCreated: false,
    handledProjectGroupFallback: false,
    shouldSend: true,
    shouldReturn: false
  };
}

export async function resolveTextPreSendEffects({
  conversation = null,
  content = '',
  handleProjectGroupTextFallback
} = {}) {
  const handledProjectGroupFallback = await handleProjectGroupTextFallback?.(conversation, content);
  if (!handledProjectGroupFallback) {
    return {
      handledProjectGroupFallback: false,
      shouldSend: true
    };
  }
  return {
    handledProjectGroupFallback: true,
    result: handledProjectGroupFallback,
    shouldSend: false,
    shouldReturn: true
  };
}
