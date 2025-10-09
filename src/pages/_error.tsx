import * as Sentry from "@sentry/nextjs";
import NextError, { type ErrorProps } from "next/error";

const CustomErrorComponent = (props: ErrorProps) => {
  return <NextError statusCode={props.statusCode} />;
};

CustomErrorComponent.getInitialProps = async (
  contextData: Parameters<typeof NextError.getInitialProps>[0],
) => {
  // In case this is running in a serverless function, await this in order to give Sentry
  // time to send the error before the lambda exits
  await Sentry.captureUnderscoreErrorException(contextData);

  // This will contain the status code of the response
  return NextError.getInitialProps(contextData);
};

export default CustomErrorComponent;
